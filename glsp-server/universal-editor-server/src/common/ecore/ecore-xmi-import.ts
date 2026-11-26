import { EAttribute, EClass, EcoreModel, EcorePackage, EDataType, EEnum, EEnumLiteral, EObject, EPackage, EReference } from './ecore-types';

export interface EcoreUploadFile {
    filename: string;
    content: string;
}

interface XmlElement {
    name: string;
    namespace: string;
    attributes: Record<string, string>;
    children: XmlElement[];
}

const ECORE_NS = 'http://www.eclipse.org/emf/2002/Ecore';
const XMI_NS = 'http://www.omg.org/XMI';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';

function parseXml({ filename, content }: EcoreUploadFile): XmlElement {
    type SaxAttribute = { name: string; local: string; uri: string; value: string };
    const sax = require('sax');
    const parser = sax.parser(true, { xmlns: true, strictEntities: true });
    const stack: XmlElement[] = [];
    let root: XmlElement | undefined;

    parser.ondoctype = () => { throw new Error('DOCTYPE declarations are unsupported'); };
    parser.onerror = (error: Error) => { throw error; };
    parser.onopentag = (tag: { local: string; uri: string; attributes: Record<string, SaxAttribute> }) => {
        const attributes: Record<string, string> = Object.create(null);
        for (const attribute of Object.values(tag.attributes)) {
            if (attribute.uri === XSI_NS && attribute.local === 'type') {
                attributes.xsiType = attribute.value.split(':').pop()!;
            } else if (!attribute.uri) {
                attributes[attribute.name] = attribute.value;
            }
        }
        const element = { name: tag.local, namespace: tag.uri, attributes, children: [] };
        const parent = stack[stack.length - 1];
        if (parent) {
            parent.children.push(element);
        } else if (root) {
            throw new Error('Expected one XML root element');
        } else {
            root = element;
        }
        stack.push(element);
    };
    parser.onclosetag = () => stack.pop();

    try {
        parser.write(content).close();
        if (!root) {
            throw new Error('Expected an Ecore XML document');
        }
        return root;
    } catch (error) {
        throw new Error(`${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

interface Resource {
    filename: string;
    objects: Map<string, EObject>;
}

type PendingLink = { resource: Resource; fragment: string; element: XmlElement; object: EObject };

function required(element: XmlElement, attribute: string, filename: string): string {
    const value = element.attributes[attribute];
    if (!value?.trim()) {
        throw new Error(`${filename}: ${element.name} is missing '${attribute}'`);
    }
    return value;
}

function integer(value: string | undefined, fallback: number): number {
    if (value === undefined) {
        return fallback;
    }
    const result = Number(value);
    if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(result)) {
        throw new Error(`Invalid Ecore integer '${value}'`);
    }
    return result;
}

function references(element: XmlElement, feature: string): string[] {
    const value = element.attributes[feature];
    if (value?.trim()) {
        return value.trim().split(/\s+/).filter(token => token.includes('#') || !token.includes(':'));
    }
    return element.children.filter(child => child.name === feature && child.attributes.href)
        .map(child => child.attributes.href);
}

export function importEcoreFiles(files: EcoreUploadFile[]): { model: EcoreModel; warnings: string[] } {
    const resources = new Map<string, Resource>();
    const packagesByURI = new Map<string, { resource: Resource; fragment: string }>();
    const classifierNames = new Set<string>();
    const pending: PendingLink[] = [];
    const model: EcoreModel = { ePackages: [] };
    const warnings: string[] = [];

    const createPackage = (element: XmlElement, resource: Resource, fragment: string): EObject => {
        const { filename } = resource;
        const name = required(element, 'name', filename);
        const nsURI = required(element, 'nsURI', filename);
        if (packagesByURI.has(nsURI)) {
            throw new Error(`${filename}: Duplicate package namespace URI '${nsURI}'`);
        }
        packagesByURI.set(nsURI, { resource, fragment });
        const pkg = EPackage.create({ name, nsURI, nsPrefix: element.attributes.nsPrefix ?? name })!;

        for (const child of element.children) {
            if (child.name === 'eClassifiers') {
                const classifierName = required(child, 'name', filename);
                if (classifierNames.has(classifierName)) {
                    throw new Error(`${filename}: Classifier name '${classifierName}' must be unique across the metamodel`);
                }
                classifierNames.add(classifierName);
                const classifier = createClassifier(child, resource, `${fragment}/${classifierName}`);
                pkg.get<{ add(object: EObject): void }>('eClassifiers')!.add(classifier);
            } else if (child.name === 'eSubpackages' || child.name === 'eSubPackages') {
                const childName = required(child, 'name', filename);
                const subpackage = createPackage(child, resource, `${fragment}/${childName}`);
                pkg.get<{ add(object: EObject): void }>('eSubPackages')!.add(subpackage);
            }
        }
        return pkg;
    };

    const createClassifier = (element: XmlElement, resource: Resource, fragment: string): EObject => {
        const { name, xsiType, instanceClassName } = element.attributes;
        let classifier: EObject;
        switch (xsiType) {
            case 'EClass':
                classifier = EClass.create({
                    name, abstract: element.attributes.abstract === 'true', interface: element.attributes.interface === 'true'
                })!;
                for (const feature of element.children.filter(child => child.name === 'eStructuralFeatures')) {
                    const featureName = required(feature, 'name', resource.filename);
                    const featureFragment = `${fragment}/${featureName}`;
                    const object = createFeature(feature, resource.filename);
                    if (resource.objects.has(featureFragment)) {
                        throw new Error(`${resource.filename}: Duplicate feature '${featureFragment}'`);
                    }
                    resource.objects.set(featureFragment, object);
                    classifier.get<{ add(object: EObject): void }>('eStructuralFeatures')!.add(object);
                    pending.push({ resource, fragment: featureFragment, element: feature, object });
                }
                break;
            case 'EEnum':
                classifier = EEnum.create({ name })!;
                for (const child of element.children.filter(node => node.name === 'eLiterals')) {
                    const literalName = required(child, 'name', resource.filename);
                    const literal = EEnumLiteral.create({
                        name: literalName, value: integer(child.attributes.value, 0), literal: child.attributes.literal ?? literalName
                    })!;
                    classifier.get<{ add(object: EObject): void }>('eLiterals')!.add(literal);
                }
                break;
            case 'EDataType':
                classifier = EDataType.create({
                    name, instanceClassName, serializable: element.attributes.serializable !== 'false'
                })!;
                break;
            default:
                throw new Error(`${resource.filename}: Unsupported classifier type '${xsiType}' for '${name}'`);
        }
        resource.objects.set(fragment, classifier);
        pending.push({ resource, fragment, element, object: classifier });
        return classifier;
    };

    for (const file of files) {
        if (resources.has(file.filename)) {
            throw new Error(`Multiple uploaded files are named '${file.filename}'`);
        }
        const root = parseXml(file);
        const roots = root.name === 'XMI' && root.namespace === XMI_NS ? root.children : [root];
        if (roots.length !== 1 || roots[0].name !== 'EPackage' || roots[0].namespace !== ECORE_NS) {
            throw new Error(`${file.filename}: Expected one Ecore EPackage root`);
        }
        const resource: Resource = { filename: file.filename, objects: new Map() };
        resources.set(file.filename, resource);
        model.ePackages.push(createPackage(roots[0], resource, '/'));
    }

    const builtins = new Map<string, EObject>();
    EcorePackage.get<{ forEach(callback: (object: EObject) => void): void }>('eClassifiers')!.forEach(object => {
        builtins.set(`//${object.get('name')}`, object);
    });

    const resolve = (resource: Resource, uri: string): EObject | undefined => {
        const separator = uri.indexOf('#');
        if (separator === -1) {
            return undefined;
        }
        const location = uri.slice(0, separator);
        const fragment = decodeURIComponent(uri.slice(separator + 1));
        if (location === ECORE_NS) {
            return builtins.get(fragment);
        }
        const pkg = packagesByURI.get(location);
        if (pkg) {
            return pkg.resource.objects.get(pkg.fragment + fragment.slice(1));
        }
        const target = location ? resources.get(decodeURIComponent(location.replace(/^\.\//, ''))) : resource;
        return target?.objects.get(fragment);
    };

    const requireTarget = (link: PendingLink, uri: string, type: string): EObject => {
        const target = resolve(link.resource, uri);
        if (!target?.isKindOf(type)) {
            throw new Error(`${link.resource.filename}#${link.fragment}: Cannot resolve '${uri}' as ${type}. Include its .ecore file in the upload.`);
        }
        return target;
    };

    for (const link of pending) {
        const { resource, element, object } = link;
        for (const uri of references(element, 'eSuperTypes')) {
            const target = requireTarget(link, uri, 'EClass');
            object.get<{ add(object: EObject): void }>('eSuperTypes')!.add(target);
        }
        if (!object.isKindOf('EStructuralFeature')) {
            continue;
        }
        const uri = references(element, 'eType')[0];
        if (!uri) {
            throw new Error(`${resource.filename}#${link.fragment}: Missing or unsupported eType`);
        }
        // The BPMN sample excludes the optional Diagram Interchange package.
        if (link.fragment === '//Definitions/diagrams' && uri === 'BPMNDI.ecore#//BPMNDiagram' &&
            object.get('lowerBound') === 0 && !resources.has('BPMNDI.ecore')) {
            object.eContainer?.get<{ remove(object: EObject): void }>('eStructuralFeatures')?.remove(object);
            resource.objects.delete(link.fragment);
            warnings.push(`${resource.filename}: Skipped optional Definitions.diagrams because BPMNDI.ecore was not uploaded.`);
            continue;
        }
        const type = object.isTypeOf('EReference') ? 'EClass' : 'EDataType';
        object.set('eType', requireTarget(link, uri, type));
    }

    for (const link of pending) {
        const uri = references(link.element, 'eOpposite')[0];
        if (uri) {
            const opposite = requireTarget(link, uri, 'EReference');
            link.object.set('eOpposite', opposite);
            opposite.set('eOpposite', link.object);
            link.object.set('container', opposite.get('containment') === true);
            opposite.set('container', link.object.get('containment') === true);
        }
    }
    return { model, warnings };
}

function createFeature(element: XmlElement, filename: string): EObject {
    const a = element.attributes;
    const properties = {
        name: a.name, lowerBound: integer(a.lowerBound, 0), upperBound: integer(a.upperBound, 1),
        ordered: a.ordered !== 'false', unique: a.unique !== 'false',
        changeable: a.changeable !== 'false', volatile: a.volatile === 'true', transient: a.transient === 'true',
        unsettable: a.unsettable === 'true', derived: a.derived === 'true', defaultValueLiteral: a.defaultValueLiteral
    };
    switch (a.xsiType) {
        case 'EAttribute':
            return EAttribute.create({ ...properties, iD: a.iD === 'true' })!;
        case 'EReference':
            return EReference.create({ ...properties, containment: a.containment === 'true', resolveProxies: a.resolveProxies !== 'false' })!;
        default:
            throw new Error(`${filename}: Unsupported feature type '${a.xsiType}' for '${a.name}'`);
    }
}
