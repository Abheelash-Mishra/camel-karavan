/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import { EdgeProps } from 'reactflow';

export interface MappingEdgeData {
    hasWarning?: boolean;
    warningMessage?: string;
    hasTransformation?: boolean;
    transformationName?: string;
    sourceFieldId?: string;
    onDelete?: (mappingId: string, sourceFieldId: string) => void;
    onEditTransformation?: (mappingId: string) => void;
    showTransformButton?: boolean;
    mappingId?: string;
    curveOffset?: number;
    controlDX?: number;
    controlDY?: number;
    onBendChange?: (edgeId: string, dx: number, dy: number) => void;
}

export function MappingEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data,
    markerEnd,
}: EdgeProps<MappingEdgeData>) {
    const curveOffset = data?.curveOffset || 0;
    const controlDX = data?.controlDX || 0;
    const controlDY = data?.controlDY || 0;

    // Compute cubic bezier path using control points closer to the straight line
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const c1x = sourceX + dx * 0.35 + controlDX;
    const c1y = sourceY + dy * 0.35 + controlDY;
    const c2x = sourceX + dx * 0.65 + controlDX;
    const c2y = sourceY + dy * 0.65 + controlDY;
    const edgePath = `M ${sourceX},${sourceY} C ${c1x},${c1y} ${c2x},${c2y} ${targetX},${targetY}`;

    // Compute label position at t=0.5 on the bezier curve
    // const t = 0.5;
    // const x = (1 - t) ** 3 * sourceX + 3 * (1 - t) ** 2 * t * c1x + 3 * (1 - t) * t ** 2 * c2x + t ** 3 * targetX;
    // const y = (1 - t) ** 3 * sourceY + 3 * (1 - t) ** 2 * t * c1y + 3 * (1 - t) * t ** 2 * c2y + t ** 3 * targetY;
    // const labelX = x;
    // const labelY = y;

    const hasWarning = data?.hasWarning || false;
    const mappingId = data?.mappingId || id;

    const edgeStyle = {
        stroke: hasWarning ? '#f0ab00' : '#06c',
        strokeWidth: 2,
        strokeDasharray: hasWarning ? '5,5' : undefined,
    };

    // Drag handling for the edge path itself (no visible handle)
    const onMouseDownPath = (e: React.MouseEvent) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const startDX = controlDX;
        const startDY = controlDY;
        let moved = false;

        const onMove = (ev: MouseEvent) => {
            const ndx = startDX + (ev.clientX - startX);
            const ndy = startDY + (ev.clientY - startY);
            data?.onBendChange?.(id, ndx, ndy);
            moved = true;
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            if (!moved) {
                // Treat as click to open transformation popup
                data?.onEditTransformation?.(mappingId!);
            }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <g>
            {/* Visible stroke */}
            <path d={edgePath} markerEnd={markerEnd as any} style={edgeStyle as any} fill="none" />
            {/* Invisible wide stroke for interaction (click/drag) */}
            <path
                d={edgePath}
                stroke="transparent"
                strokeWidth={16}
                fill="none"
                style={{ cursor: 'pointer' }}
                onMouseDown={onMouseDownPath}
            />
        </g>
    );
}
