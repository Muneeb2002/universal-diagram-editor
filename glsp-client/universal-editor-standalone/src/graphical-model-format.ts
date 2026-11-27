import type { GraphicalElement } from './graphical-model-editor';
import type { CreationContainerPath } from './ecore-client-actions';

const ECORE_NS = 'http://www.eclipse.org/emf/2002/Ecore';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
const MODEL = 'urn:universal-diagram-editor:graphical-model';
const SHAPE = 'urn:universal-diagram-editor:shape';
const COMPONENT = 'urn:universal-diagram-editor:component';
const TEXT_FIELDS = ['id', 'name', 'type', 'color', 'fillColor', 'lineStyle', 'arrowType', 'childBinding', 'svgContent',
    'widthResizeGroup', 'heightResizeGroup', 'laneLayout', 'laneLayoutBand'] as const;
const NUMBER_FIELDS = ['x', 'y', 'width', 'height', 'lineThickness', 'rotation'] as const;
const BOOLEAN_FIELDS = ['filled', 'resizeHorizontal', 'resizeVertical'] as const;

export interface GraphicalModelData {
    shapes?: unknown;
    elements?: unknown;
    mappableClasses?: unknown;
    creationContainers?: unknown;
}

function childrenOf(element: Element, name: string): Element[] {
    return Array.from(element.children).filter(child => child.localName === name);
}

function annotations(element: Element, source: string): Element[] {
    return childrenOf(element, 'eAnnotations').filter(child => child.getAttribute('source') === source);
}

function readDetails(element: Element): Map<string, string> {
    const details = new Map<string, string>();
    for (const entry of childrenOf(element, 'details')) {
        const key = entry.getAttribute('key');
        const value = entry.getAttribute('value');
        if (!key || value === null || details.has(key)) {
            throw new Error('Each graphical Ecore annotation detail needs a unique key and a value.');
        }
        details.set(key, value);
    }
    return details;
}

function readShape(element: Element): Record<string, unknown> {
    const details = readDetails(element);
    const id = details.get('id');
    if (!id?.trim() || !details.get('type')?.trim()) {
        throw new Error('Each graphical Ecore shape needs an id and a type.');
    }
    const shape: Record<string, unknown> = {};
    for (const field of TEXT_FIELDS) {
        if (details.has(field)) {
            shape[field] = details.get(field);
        }
    }
    for (const field of NUMBER_FIELDS) {
        const value = details.get(field);
        if (value === undefined) continue;
        if (value.trim() === '' || !Number.isFinite(Number(value))) {
            throw new Error(`Shape '${id}' has an invalid number for '${field}'.`);
        }
        shape[field] = Number(value);
    }
    for (const field of BOOLEAN_FIELDS) {
        const value = details.get(field);
        if (value === undefined) continue;
        if (value !== 'true' && value !== 'false') {
            throw new Error(`Shape '${id}' must use true or false for '${field}'.`);
        }
        shape[field] = value === 'true';
    }
    const components = annotations(element, COMPONENT);
    if (components.length) {
        shape.components = components.map(readShape);
    }
    return shape;
}

export function parseGraphicalModel(content: string): GraphicalModelData {
    if (!content.trimStart().startsWith('<')) {
        const model = JSON.parse(content);
        if (!model || typeof model !== 'object') {
            throw new Error('Expected a graphical model object.');
        }
        return model;
    }

    const xml = new DOMParser().parseFromString(content, 'application/xml');
    const root = xml.documentElement;
    if (xml.doctype || xml.getElementsByTagNameNS('*', 'parsererror').length) {
        throw new Error('Expected well-formed graphical Ecore XML without a DOCTYPE.');
    }
    if (root.namespaceURI !== ECORE_NS || root.localName !== 'EPackage') {
        throw new Error('The graphical Ecore file must have an EPackage root.');
    }
    const [model] = annotations(root, MODEL);
    if (!model) {
        throw new Error('The EPackage is missing the graphical model annotation. Select a graphical Ecore file such as bpmn-core.ecore.');
    }
    const details = readDetails(model);
    const mappableClasses = details.get('mappableClasses')?.trim().split(/\s+/).filter(Boolean);
    const creationContainers = details.get('creationContainers');
    const shapes = childrenOf(root, 'eClassifiers').flatMap(classifier => annotations(classifier, SHAPE).map(readShape));
    return { mappableClasses, creationContainers, shapes };
}

// Format: RootClass/containmentReference:ChildClass, with whitespace between paths.
export function readCreationContainerPaths(value: unknown): CreationContainerPath[] {
    if (value === undefined) return [];
    if (typeof value !== 'string') {
        throw new Error('Expected creationContainers to be a list of containment paths.');
    }
    return value.trim().split(/\s+/).filter(Boolean).map(path => {
        const [rootClass, ...segments] = path.split('/');
        if (!/^[A-Za-z_]\w*$/.test(rootClass) || segments.some(segment => !/^[A-Za-z_]\w*:[A-Za-z_]\w*$/.test(segment))) {
            throw new Error(`Invalid creation container path '${path}'.`);
        }
        return {
            rootClass,
            steps: segments.map(segment => {
                const [referenceName, className] = segment.split(':');
                return { referenceName, className };
            })
        };
    });
}

function escapeXml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\r/g, '&#13;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
}

function writeShape(shape: GraphicalElement, source: string, indent: string): string[] {
    const lines = [`${indent}<eAnnotations source="${source}">`];
    for (const field of [...TEXT_FIELDS, ...NUMBER_FIELDS, ...BOOLEAN_FIELDS]) {
        const value = shape[field];
        if (value !== undefined) {
            lines.push(`${indent}  <details key="${field}" value="${escapeXml(String(value))}"/>`);
        }
    }
    for (const component of shape.components ?? []) {
        lines.push(...writeShape(component, COMPONENT, indent + '  '));
    }
    lines.push(`${indent}</eAnnotations>`);
    return lines;
}

function ecoreName(value: string): string {
    const name = value.replace(/[^a-zA-Z0-9_]+/g, '_');
    return /^[a-zA-Z_]/.test(name) ? name : `_${name}`;
}

export function serializeGraphicalEcore(
    shapes: GraphicalElement[], mappableClasses: string[] | undefined, filename: string, creationContainers?: string
): string {
    const basename = filename.split(/[\\/]/).pop()?.replace(/\.ecore$/i, '') || 'GraphicalModel';
    const name = ecoreName(basename);
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="${XSI_NS}"`,
        `    xmlns:ecore="${ECORE_NS}" name="${name}" nsURI="urn:universal-diagram-editor:graphics:${name}" nsPrefix="${name}">`,
        `  <eAnnotations source="${MODEL}">`,
        `    <details key="mappableClasses" value="${escapeXml((mappableClasses ?? []).join(' '))}"/>`,
        ...(creationContainers ? [`    <details key="creationContainers" value="${escapeXml(creationContainers)}"/>`] : []),
        '  </eAnnotations>'
    ];
    shapes.forEach((shape, index) => {
        lines.push(
            `  <eClassifiers xsi:type="ecore:EClass" name="${ecoreName(shape.name)}_${index + 1}">`,
            ...writeShape(shape, SHAPE, '    '),
            '  </eClassifiers>'
        );
    });
    return [...lines, '</ecore:EPackage>', ''].join('\n');
}
