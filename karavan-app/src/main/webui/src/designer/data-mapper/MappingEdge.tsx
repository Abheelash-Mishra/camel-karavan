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
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import { Button, Tooltip } from '@patternfly/react-core';
import { TimesIcon, EditIcon } from '@patternfly/react-icons';

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
}

export function MappingEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
    source,
}: EdgeProps<MappingEdgeData>) {
    const curveOffset = data?.curveOffset || 0;
    
    // Calculate control points with offset to prevent overlapping
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        curvature: 0.25 + Math.abs(curveOffset) * 0.01,
    });

    const hasWarning = data?.hasWarning || false;
    const hasTransformation = data?.hasTransformation || false;
    const showTransformButton = data?.showTransformButton === true;
    const mappingId = data?.mappingId || id;
    const sourceFieldIdFromNode = source?.replace('source-', '') || '';
    const sourceFieldId = (data && (data as any).sourceFieldId) || (source && source.startsWith('const-') ? source.replace('const-', '') : sourceFieldIdFromNode) || '';

    const edgeStyle = {
        stroke: hasWarning ? '#f0ab00' : '#06c',
        strokeWidth: 2,
        strokeDasharray: hasWarning ? '5,5' : undefined,
    };

    return (
        <>
            <BaseEdge 
                id={id} 
                path={edgePath} 
                markerEnd={markerEnd}
                style={edgeStyle}
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                    }}
                    className="edge-label-container"
                >
                    <div className="edge-actions">
                        {showTransformButton && hasTransformation && data?.transformationName && (
                            <Tooltip content={`Transformation: ${data.transformationName}`}>
                                <Button
                                    variant="plain"
                                    size="sm"
                                    className="edge-transform-badge"
                                    onClick={() => data?.onEditTransformation?.(mappingId)}
                                >
                                    <EditIcon /> {data.transformationName}
                                </Button>
                            </Tooltip>
                        )}
                        
                        {showTransformButton && !hasTransformation && (
                            <Tooltip content="Add transformation">
                                <Button
                                    variant="plain"
                                    size="sm"
                                    onClick={() => data?.onEditTransformation?.(mappingId)}
                                >
                                    <EditIcon />
                                </Button>
                            </Tooltip>
                        )}

                        <Tooltip content={hasWarning ? data?.warningMessage : "Delete mapping"}>
                            <Button
                                variant="plain"
                                size="sm"
                                onClick={() => data?.onDelete?.(mappingId, sourceFieldId)}
                                className={hasWarning ? 'edge-warning' : ''}
                            >
                                <TimesIcon />
                            </Button>
                        </Tooltip>
                    </div>

                    {hasWarning && data?.warningMessage && (
                        <div className="edge-warning-message">
                            ⚠ {data.warningMessage}
                        </div>
                    )}
                </div>
            </EdgeLabelRenderer>
        </>
    );
}
