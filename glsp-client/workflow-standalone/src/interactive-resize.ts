 /********************************************************************************
  * Copyright (c) 2024 Eclipse GLSP and others.
  *
  * This program and the accompanying materials are made available under the
  * terms of the Eclipse Public License v. 2.0 which is available at
  * http://www.eclipse.org/legal/epl-2.0.
  *
  * SPDX-License-Identifier: EPL-2.0
  ********************************************************************************/

// Interactive resize functionality for shapes

// Global type declaration for action dispatcher
declare global {
    interface Window {
        actionDispatcher?: {
            dispatch: (action: any) => Promise<any>;
        };
    }
}

let isResizing = false;
let resizeDirection = '';
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;
let currentNode: any = null;

export function setupInteractiveResize(): void {
    // Use event delegation on the diagram container
    const diagramContainer = document.getElementById('sprotty-container');
    if (diagramContainer) {
        // Use event delegation with capture phase to handle resize handles before GLSP
        diagramContainer.addEventListener('mousedown', handleMouseDown, true);
        diagramContainer.addEventListener('mousemove', handleMouseMove, true);
        diagramContainer.addEventListener('mouseup', handleMouseUp, true);
    } else {
        // Fallback to document with capture phase
        document.addEventListener('mousedown', handleMouseDown, true);
        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('mouseup', handleMouseUp, true);
    }
}

function handleMouseDown(event: MouseEvent): void {
    const target = event.target as SVGElement;
    if (!target) return;

    // Only handle resize handle clicks
    if (target.classList.contains('resize-handle')) {
        event.preventDefault();
        event.stopPropagation();
        
        isResizing = true;
        resizeDirection = target.getAttribute('data-resize-direction') || '';
        
        // Find the parent node
        const nodeElement = target.closest('.node');
        if (nodeElement) {
            currentNode = nodeElement;
            startX = event.clientX;
            startY = event.clientY;
            
            // Get current size from the node
            const rect = nodeElement.querySelector('rect, circle, ellipse, polygon, path');
            if (rect) {
                if (rect.tagName === 'rect') {
                    startWidth = parseFloat(rect.getAttribute('width') || '100');
                    startHeight = parseFloat(rect.getAttribute('height') || '60');
                } else if (rect.tagName === 'circle') {
                    const radius = parseFloat(rect.getAttribute('r') || '30');
                    startWidth = radius * 2;
                    startHeight = radius * 2;
                } else if (rect.tagName === 'ellipse') {
                    const rx = parseFloat(rect.getAttribute('rx') || '50');
                    const ry = parseFloat(rect.getAttribute('ry') || '30');
                    startWidth = rx * 2;
                    startHeight = ry * 2;
                }
            }
        }
    }
    // For all other elements, let the event pass through to GLSP for drag handling
}

function handleMouseMove(event: MouseEvent): void {
    if (!isResizing || !currentNode) {
        return;
    }
    
    event.preventDefault();
    
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    
    let newWidth = startWidth;
    let newHeight = startHeight;
    
    // Calculate new dimensions based on resize direction
    switch (resizeDirection) {
        case 'se': // Southeast corner
            newWidth = Math.max(50, startWidth + deltaX);
            newHeight = Math.max(30, startHeight + deltaY);
            break;
        case 'sw': // Southwest corner
            newWidth = Math.max(50, startWidth - deltaX);
            newHeight = Math.max(30, startHeight + deltaY);
            break;
        case 'ne': // Northeast corner
            newWidth = Math.max(50, startWidth + deltaX);
            newHeight = Math.max(30, startHeight - deltaY);
            break;
        case 'nw': // Northwest corner
            newWidth = Math.max(50, startWidth - deltaX);
            newHeight = Math.max(30, startHeight - deltaY);
            break;
        case 'e': // East edge
            newWidth = Math.max(50, startWidth + deltaX);
            break;
        case 'w': // West edge
            newWidth = Math.max(50, startWidth - deltaX);
            break;
        case 's': // South edge
            newHeight = Math.max(30, startHeight + deltaY);
            break;
        case 'n': // North edge
            newHeight = Math.max(30, startHeight - deltaY);
            break;
    }
    
    // Update the node size in real-time
    updateNodeSize(currentNode, newWidth, newHeight);
}

function handleMouseUp(event: MouseEvent): void {
    if (isResizing && currentNode) {
        // Send resize action to server
        const nodeId = currentNode.id;
        const rect = currentNode.querySelector('rect, circle, ellipse, polygon, path');
        if (rect) {
            let finalWidth = 100;
            let finalHeight = 60;
            
            if (rect.tagName === 'rect') {
                finalWidth = parseFloat(rect.getAttribute('width') || '100');
                finalHeight = parseFloat(rect.getAttribute('height') || '60');
            } else if (rect.tagName === 'circle') {
                const radius = parseFloat(rect.getAttribute('r') || '30');
                finalWidth = radius * 2;
                finalHeight = radius * 2;
            }
            
            // Dispatch resize action
            if (window.actionDispatcher) {
                const action = {
                    kind: 'resizeInstance',
                    nodeId: nodeId,
                    width: finalWidth,
                    height: finalHeight
                };
                window.actionDispatcher.dispatch(action);
            }
        }
    }
    
    isResizing = false;
    resizeDirection = '';
    currentNode = null;
}

function updateNodeSize(nodeElement: Element, width: number, height: number): void {
    const rect = nodeElement.querySelector('rect, circle, ellipse, polygon, path');
    if (!rect) return;
    
    if (rect.tagName === 'rect') {
        rect.setAttribute('width', width.toString());
        rect.setAttribute('height', height.toString());
    } else if (rect.tagName === 'circle') {
        const radius = Math.min(width, height) / 2;
        rect.setAttribute('r', radius.toString());
    } else if (rect.tagName === 'ellipse') {
        rect.setAttribute('rx', (width / 2).toString());
        rect.setAttribute('ry', (height / 2).toString());
    } else if (rect.tagName === 'polygon') {
        // For triangles, update the points based on the new dimensions
        const points = rect.getAttribute('points');
        if (points) {
            // Simple triangle scaling - this could be improved for more complex polygons
            const scaleX = width / 100; // Assuming original width was 100
            const scaleY = height / 60; // Assuming original height was 60
            const scaledPoints = points.split(' ').map(point => {
                const [x, y] = point.split(',').map(Number);
                return `${x * scaleX},${y * scaleY}`;
            }).join(' ');
            rect.setAttribute('points', scaledPoints);
        }
    }
    // Note: Path elements (arrows) are more complex to resize and might need special handling
    
    // Update resize handles position
    const resizeHandles = nodeElement.querySelectorAll('.resize-handle');
    resizeHandles.forEach(handle => {
        const direction = handle.getAttribute('data-resize-direction');
        if (direction) {
            updateResizeHandlePosition(handle as SVGElement, direction, width, height);
        }
    });
}

function updateResizeHandlePosition(handle: SVGElement, direction: string, width: number, height: number): void {
    const handleSize = 8;
    const halfHandle = handleSize / 2;
    
    switch (direction) {
        case 'nw':
            handle.setAttribute('x', (-halfHandle).toString());
            handle.setAttribute('y', (-halfHandle).toString());
            break;
        case 'ne':
            handle.setAttribute('x', (width - halfHandle).toString());
            handle.setAttribute('y', (-halfHandle).toString());
            break;
        case 'sw':
            handle.setAttribute('x', (-halfHandle).toString());
            handle.setAttribute('y', (height - halfHandle).toString());
            break;
        case 'se':
            handle.setAttribute('x', (width - halfHandle).toString());
            handle.setAttribute('y', (height - halfHandle).toString());
            break;
        case 'n':
            handle.setAttribute('x', (width / 2 - halfHandle).toString());
            handle.setAttribute('y', (-halfHandle).toString());
            break;
        case 's':
            handle.setAttribute('x', (width / 2 - halfHandle).toString());
            handle.setAttribute('y', (height - halfHandle).toString());
            break;
        case 'w':
            handle.setAttribute('x', (-halfHandle).toString());
            handle.setAttribute('y', (height / 2 - halfHandle).toString());
            break;
        case 'e':
            handle.setAttribute('x', (width - halfHandle).toString());
            handle.setAttribute('y', (height / 2 - halfHandle).toString());
            break;
    }
}
