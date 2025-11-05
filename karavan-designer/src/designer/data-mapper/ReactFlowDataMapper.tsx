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

import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Controls,
    Background,
    Connection,
    addEdge,
    useNodesState,
    useEdgesState,
    MarkerType,
    ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './data-mapper.css';
import {
    PageSection,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
    Button,
    Divider,
    EmptyState,
    EmptyStateIcon,
    EmptyStateBody,
    Title,
    Label,
    Badge,
    Modal,
    ModalVariant,
    Tooltip,
} from '@patternfly/react-core';
import {
    UploadIcon,
    TrashIcon,
    DownloadIcon,
    CodeIcon,
    PlusCircleIcon,
    CheckCircleIcon,
} from '@patternfly/react-icons';
import { v4 as uuidv4 } from 'uuid';
import { shallow } from 'zustand/shallow';

import { useDataMapperStore } from './DataMapperStore';
import { ListMappingModal } from './ListMappingModal';
import { FieldNode, FieldNodeData } from './FieldNode';
import { MappingEdge, MappingEdgeData } from './MappingEdge';
import { UploadFileModal } from './UploadFileModal';
import { JsltEditorModal } from './JsltEditorModal';
import { TransformationPopup } from './TransformationPopup';
import { MultiSourcePopup } from './MultiSourcePopup';
import { ValidationWarningPanel } from './ValidationWarningPanel';
import { AddConstantModal } from './AddConstantModal';
import { AddTargetFieldModal } from './AddTargetFieldModal';
import { SchemaParser } from './SchemaParser';
import { JsltGenerator } from './JsltGenerator';
import { JsltParser } from './JsltParser';
import { 
    SchemaType, 
    FieldMapping, 
    ArrayIterationMode,
    IndexSelector,
    ListMappingConfig,
    FieldDefinition,
    TransformationFunction,
} from './DataMapperTypes';

const nodeTypes = {
    fieldNode: FieldNode,
};

const edgeTypes = {
    mappingEdge: MappingEdge,
};

export function ReactFlowDataMapper() {
    const [
        sourceSchema,
        targetSchema,
        mappings,
        validationWarnings,
        generatedJslt,
        showUploadModal,
        uploadModalType,
        showJsltEditorModal,
        showTransformationPopup,
        showMultiSourcePopup,
        selectedMappingForTransform,
        selectedTargetForMultiSource,
        constants,
        customTargetFields,
        showAddConstantModal,
        showAddTargetFieldModal,
        showListMappingModal,
        selectedFieldForListMapping,
        listMappingConfigs,
        setSourceSchema,
        setTargetSchema,
        addMapping,
        updateMapping,
        removeMapping,
        setMappings,
        setValidationWarnings,
        clearValidationWarnings,
        setGeneratedJslt,
        setShowUploadModal,
        setShowJsltEditorModal,
        setShowTransformationPopup,
        setShowMultiSourcePopup,
        addConstant,
        removeConstant,
        addCustomTargetField,
        removeCustomTargetField,
        setShowAddConstantModal,
        setShowAddTargetFieldModal,
        updateFieldArrayMode,
        updateFieldIndexSelector,
        setShowListMappingModal,
        addListMappingConfig,
        clearMappings,
    ] = useDataMapperStore(
        (s) => [
            s.sourceSchema,
            s.targetSchema,
            s.mappings,
            s.validationWarnings,
            s.generatedJslt,
            s.showUploadModal,
            s.uploadModalType,
            s.showJsltEditorModal,
            s.showTransformationPopup,
            s.showMultiSourcePopup,
            s.selectedMappingForTransform,
            s.selectedTargetForMultiSource,
            s.constants,
            s.customTargetFields,
            s.showAddConstantModal,
            s.showAddTargetFieldModal,
            s.showListMappingModal,
            s.selectedFieldForListMapping,
            s.listMappingConfigs,
            s.setSourceSchema,
            s.setTargetSchema,
            s.addMapping,
            s.updateMapping,
            s.removeMapping,
            s.setMappings,
            s.setValidationWarnings,
            s.clearValidationWarnings,
            s.setGeneratedJslt,
            s.setShowUploadModal,
            s.setShowJsltEditorModal,
            s.setShowTransformationPopup,
            s.setShowMultiSourcePopup,
            s.addConstant,
            s.removeConstant,
            s.addCustomTargetField,
            s.removeCustomTargetField,
            s.setShowAddConstantModal,
            s.setShowAddTargetFieldModal,
            s.updateFieldArrayMode,
            s.updateFieldIndexSelector,
            s.setShowListMappingModal,
            s.addListMappingConfig,
            s.clearMappings,
        ],
        shallow
    );

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [showClearMappingsConfirm, setShowClearMappingsConfirm] = useState(false);
    const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);

    // Generate nodes from schemas
    useEffect(() => {
        const newNodes: Node<FieldNodeData>[] = [];
        let sourceYPosition = 0;
        let targetYPosition = 0;

        // Add source schema fields
        if (sourceSchema) {
            sourceSchema.fields.forEach((field) => {
                newNodes.push({
                    id: `source-${field.id}`,
                    type: 'fieldNode',
                    position: { x: 50, y: sourceYPosition },
                    data: {
                        field,
                        side: 'source',
                        onArrayModeChange: handleArrayModeChange,
                        onIndexSelectorChange: handleIndexSelectorChange,
                        onListMappingOpen: handleListMappingOpen,
                    },
                });
                sourceYPosition += 80;
            });
        }

        // Add constant values as source nodes
        constants.forEach((constant) => {
            newNodes.push({
                id: `const-${constant.id}`,
                type: 'fieldNode',
                position: { x: 50, y: sourceYPosition },
                data: {
                    field: {
                        id: constant.id,
                        name: constant.name,
                        path: constant.name,
                        type: constant.type,
                        isArray: false,
                        description: `Constant: ${constant.value}`,
                    },
                    side: 'source',
                    onDelete: () => removeConstant(constant.id),
                },
            });
            sourceYPosition += 80;
        });

        // Add target schema fields
        if (targetSchema) {
            targetSchema.fields.forEach((field) => {
                newNodes.push({
                    id: `target-${field.id}`,
                    type: 'fieldNode',
                    position: { x: 600, y: targetYPosition },
                    data: {
                        field,
                        side: 'target',
                    },
                });
                targetYPosition += 80;
            });
        }

        // Add custom target fields
        customTargetFields.forEach((field) => {
            newNodes.push({
                id: `target-${field.id}`,
                type: 'fieldNode',
                position: { x: 600, y: targetYPosition },
                data: {
                    field,
                    side: 'target',
                    onDelete: () => removeCustomTargetField(field.id),
                },
            });
            targetYPosition += 80;
        });

        setNodes(newNodes);
    }, [sourceSchema, targetSchema, constants, customTargetFields]);

    // Generate edges from mappings
    useEffect(() => {
        const newEdges: Edge<MappingEdgeData>[] = [];
        
        // Group mappings by target to calculate offsets for overlapping edges
        const targetToMappings = new Map<string, Array<{mapping: FieldMapping, sourceIndex: number}>>();
        mappings.forEach(mapping => {
            if (!targetToMappings.has(mapping.targetFieldId)) {
                targetToMappings.set(mapping.targetFieldId, []);
            }
            mapping.sourceFieldIds.forEach((sourceId, idx) => {
                targetToMappings.get(mapping.targetFieldId)!.push({mapping, sourceIndex: idx});
            });
        });

        mappings.forEach((mapping) => {
            const targetFieldId = mapping.targetFieldId;
            const isMultiSource = mapping.sourceFieldIds.length > 1;
            const edgesForThisTarget = targetToMappings.get(targetFieldId) || [];
            
            mapping.sourceFieldIds.forEach((sourceFieldId, index) => {
                const edgeId = `${sourceFieldId}-${targetFieldId}-${index}`;
                
                // Check for type compatibility warning
                const sourceField = sourceSchema?.fields.find(f => f.id === sourceFieldId);
                const targetField = targetSchema?.fields.find(f => f.id === targetFieldId);
                const hasWarning = sourceField && targetField && sourceField.type !== targetField.type;
                const warningMessage = hasWarning 
                    ? `Type mismatch: ${sourceField?.type} → ${targetField?.type}`
                    : undefined;

                // Only show transformation button on the first edge of multi-source mappings
                const showTransformation = !isMultiSource || index === 0;

                // Calculate curve offset to prevent overlapping
                const totalEdges = edgesForThisTarget.length;
                const edgeIndex = edgesForThisTarget.findIndex(e => 
                    e.mapping.id === mapping.id && e.sourceIndex === index
                );
                const offset = totalEdges > 1 ? (edgeIndex - (totalEdges - 1) / 2) * 30 : 0;

                newEdges.push({
                    id: edgeId,
                    source: `source-${sourceFieldId}`,
                    target: `target-${targetFieldId}`,
                    sourceHandle: `${sourceFieldId}-source`,
                    targetHandle: `${targetFieldId}-target`,
                    type: 'mappingEdge',
                    markerEnd: { type: MarkerType.ArrowClosed },
                    style: { 
                        strokeWidth: 2,
                    },
                    data: {
                        hasWarning,
                        warningMessage,
                        hasTransformation: showTransformation && !!mapping.transformation,
                        transformationName: mapping.transformation?.name,
                        onDelete: () => handleDeleteMapping(mapping.id, sourceFieldId),
                        onEditTransformation: showTransformation ? () => handleEditTransformation(mapping.id) : undefined,
                        showTransformButton: showTransformation,
                        mappingId: mapping.id,
                        curveOffset: offset,
                    },
                });
            });
        });

        setEdges(newEdges);
    }, [mappings, sourceSchema, targetSchema]);

    const handleArrayModeChange = (fieldId: string, mode: ArrayIterationMode) => {
        updateFieldArrayMode(fieldId, mode);
    };

    const handleIndexSelectorChange = (fieldId: string, selector: IndexSelector, customIndex?: number) => {
        updateFieldIndexSelector(fieldId, selector, customIndex);
    };

    const handleListMappingOpen = (fieldId: string) => {
        setShowListMappingModal(true, fieldId);
    };

    const onConnect = useCallback(
        (params: Connection) => {
            const sourceFieldId = params.source?.replace('source-', '');
            const targetFieldId = params.target?.replace('target-', '');

            if (!sourceFieldId || !targetFieldId) return;

            // Check if target already has mappings
            const existingMappings = mappings.filter(m => m.targetFieldId === targetFieldId);

            if (existingMappings.length > 0) {
                // Multi-source mapping - show popup
                const existingMapping = existingMappings[0];
                if (!existingMapping.sourceFieldIds.includes(sourceFieldId)) {
                    updateMapping(existingMapping.id, {
                        sourceFieldIds: [...existingMapping.sourceFieldIds, sourceFieldId],
                    });
                    setShowMultiSourcePopup(true, targetFieldId);
                }
            } else {
                // New mapping
                const newMapping: FieldMapping = {
                    id: uuidv4(),
                    sourceFieldIds: [sourceFieldId],
                    targetFieldId,
                };
                addMapping(newMapping);
            }
        },
        [mappings, addMapping, updateMapping, setShowMultiSourcePopup]
    );

    const handleDeleteMapping = (mappingId: string, sourceFieldId: string) => {
        const mapping = mappings.find(m => m.id === mappingId);
        if (!mapping) return;

        // If this is a multi-source mapping, only remove the specific source
        if (mapping.sourceFieldIds.length > 1) {
            updateMapping(mappingId, {
                sourceFieldIds: mapping.sourceFieldIds.filter(id => id !== sourceFieldId),
            });
        } else {
            // Remove the entire mapping if it's the last source
            removeMapping(mappingId);
        }
    };

    const handleEditTransformation = (mappingId: string) => {
        setShowTransformationPopup(true, mappingId);
    };

    const handleUploadSource = (content: any, schemaType: SchemaType, fileName: string) => {
        const fields = SchemaParser.parse(content, schemaType, fileName);
        setSourceSchema({
            type: schemaType,
            fileName,
            content,
            fields,
        });
    };

    const handleUploadTarget = (content: any, schemaType: SchemaType, fileName: string) => {
        const fields = SchemaParser.parse(content, schemaType, fileName);
        setTargetSchema({
            type: schemaType,
            fileName,
            content,
            fields,
        });
    };

    const handleGenerateJslt = () => {
        const jslt = JsltGenerator.generate(sourceSchema, targetSchema, mappings, listMappingConfigs);
        const validation = JsltGenerator.validate(jslt);
        
        setGeneratedJslt(jslt);
        
        if (!validation.valid) {
            setValidationWarnings(validation.errors.map(err => ({
                id: uuidv4(),
                message: err,
                severity: 'error',
            })));
        }
        
        setShowJsltEditorModal(true);
    };

    const handleApplyJslt = (jslt: string) => {
        setGeneratedJslt(jslt);
        
        // Parse JSLT and update mappings
        const parseResult = JsltParser.parse(jslt, sourceSchema, targetSchema);
        setMappings(parseResult.mappings);
        setValidationWarnings(parseResult.warnings);
    };

    const handleUploadJslt = (content: any, schemaType: SchemaType, fileName: string) => {
        // Treat JSLT upload as text content
        const jsltContent = typeof content === 'string' ? content : JSON.stringify(content);
        handleApplyJslt(jsltContent);
    };

    const handleApplyTransformation = (transformation: TransformationFunction | undefined) => {
        if (selectedMappingForTransform) {
            updateMapping(selectedMappingForTransform, { transformation });
        }
    };

    const handleApplyMultiSourceExpression = (expression: string) => {
        if (selectedTargetForMultiSource) {
            const mapping = mappings.find(m => m.targetFieldId === selectedTargetForMultiSource);
            if (mapping) {
                updateMapping(mapping.id, { multiSourceExpression: expression });
            }
        }
    };

    const currentMappingForTransform = mappings.find(m => m.id === selectedMappingForTransform);
    const currentMappingForMultiSource = mappings.find(m => m.targetFieldId === selectedTargetForMultiSource);

    const hasSchemas = sourceSchema && targetSchema;
    const hasMappings = mappings.length > 0;

    return (
        <PageSection className="data-mapper-designer" isFilled padding={{ default: 'noPadding' }}>
            <Toolbar id="data-mapper-toolbar">
                <ToolbarContent>
                    <ToolbarItem>
                        <Tooltip content={sourceSchema ? `${sourceSchema.fileName} (${sourceSchema.fields.length} fields)` : 'Upload source JSON schema or sample'}>
                            <Button
                                variant={sourceSchema ? "secondary" : "primary"}
                                icon={sourceSchema ? <CheckCircleIcon /> : <UploadIcon />}
                                onClick={() => setShowUploadModal(true, 'source')}
                            >
                                {sourceSchema ? 'Change Source' : 'Upload Source'}
                                {sourceSchema && <Badge isRead style={{ marginLeft: 4 }}>{sourceSchema.fields.length}</Badge>}
                            </Button>
                        </Tooltip>
                    </ToolbarItem>
                    <ToolbarItem>
                        <Tooltip content={targetSchema ? `${targetSchema.fileName} (${targetSchema.fields.length} fields)` : 'Upload target JSON schema or sample'}>
                            <Button
                                variant={targetSchema ? "secondary" : "primary"}
                                icon={targetSchema ? <CheckCircleIcon /> : <UploadIcon />}
                                onClick={() => setShowUploadModal(true, 'target')}
                            >
                                {targetSchema ? 'Change Target' : 'Upload Target'}
                                {targetSchema && <Badge isRead style={{ marginLeft: 4 }}>{targetSchema.fields.length}</Badge>}
                            </Button>
                        </Tooltip>
                    </ToolbarItem>
                    <ToolbarItem>
                        <Button
                            variant="secondary"
                            icon={<PlusCircleIcon />}
                            onClick={() => setShowUploadModal(true, 'source')}
                            isDisabled={!hasSchemas}
                        >
                            Upload JSLT
                        </Button>
                    </ToolbarItem>
                    <ToolbarItem>
                        <Tooltip content="Add a constant value as a source">
                            <Button
                                variant="tertiary"
                                icon={<PlusCircleIcon />}
                                onClick={() => setShowAddConstantModal(true)}
                            >
                                Add Constant
                            </Button>
                        </Tooltip>
                    </ToolbarItem>
                    <ToolbarItem>
                        <Tooltip content="Add a custom field to target">
                            <Button
                                variant="tertiary"
                                icon={<PlusCircleIcon />}
                                onClick={() => setShowAddTargetFieldModal(true)}
                            >
                                Add Target Field
                            </Button>
                        </Tooltip>
                    </ToolbarItem>
                    <ToolbarItem variant="separator" />
                    <ToolbarItem>
                        <Button
                            variant="secondary"
                            icon={<CodeIcon />}
                            onClick={handleGenerateJslt}
                            isDisabled={!hasMappings}
                        >
                            Generate JSLT
                        </Button>
                    </ToolbarItem>
                    <ToolbarItem variant="separator" />
                    <ToolbarItem align={{ default: 'alignRight' }}>
                        <Button
                            variant="warning"
                            icon={<TrashIcon />}
                            onClick={() => setShowClearMappingsConfirm(true)}
                            isDisabled={!hasMappings}
                        >
                            Clear Mappings
                        </Button>
                    </ToolbarItem>
                    <ToolbarItem>
                        <Button
                            variant="danger"
                            icon={<TrashIcon />}
                            onClick={() => setShowResetAllConfirm(true)}
                            isDisabled={!sourceSchema && !targetSchema}
                        >
                            Reset All
                        </Button>
                    </ToolbarItem>
                </ToolbarContent>
            </Toolbar>

            <Divider />

            <ValidationWarningPanel
                warnings={validationWarnings}
                onDismiss={(id) => {
                    setValidationWarnings(validationWarnings.filter(w => w.id !== id));
                }}
                onDismissAll={clearValidationWarnings}
            />

            <div style={{ height: 'calc(100vh - 200px)' }}>
                {!hasSchemas ? (
                    <EmptyState>
                        <EmptyStateIcon icon={UploadIcon} />
                        <Title headingLevel="h4" size="lg">
                            No schemas loaded
                        </Title>
                        <EmptyStateBody>
                            Upload source and target JSON schemas or sample JSON files to begin mapping.
                        </EmptyStateBody>
                        <Button variant="primary" onClick={() => setShowUploadModal(true, 'source')}>
                            Upload Source Schema
                        </Button>
                    </EmptyState>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        fitView
                        attributionPosition="bottom-left"
                        connectionLineStyle={{ stroke: '#0066cc', strokeWidth: 2 }}
                        connectionLineType={ConnectionLineType.Bezier}
                    >
                        <Background />
                        <Controls />
                    </ReactFlow>
                )}
            </div>

            <UploadFileModal
                isOpen={showUploadModal}
                title={uploadModalType === 'source' ? 'Upload Source Schema' : 'Upload Target Schema'}
                onClose={() => setShowUploadModal(false)}
                onUpload={uploadModalType === 'source' ? handleUploadSource : handleUploadTarget}
            />

            <JsltEditorModal
                isOpen={showJsltEditorModal}
                jslt={generatedJslt}
                onClose={() => setShowJsltEditorModal(false)}
                onApply={handleApplyJslt}
            />

            <TransformationPopup
                isOpen={showTransformationPopup}
                currentMapping={currentMappingForTransform}
                sourceFields={sourceSchema?.fields}
                targetFields={targetSchema?.fields}
                onClose={() => setShowTransformationPopup(false)}
                onApply={handleApplyTransformation}
                onEditMultiSource={() => {
                    if (currentMappingForTransform) {
                        setShowMultiSourcePopup(true, currentMappingForTransform.targetFieldId);
                    }
                }}
            />

            <MultiSourcePopup
                isOpen={showMultiSourcePopup}
                sourceFieldIds={currentMappingForMultiSource?.sourceFieldIds || []}
                sourceFields={sourceSchema?.fields}
                currentExpression={currentMappingForMultiSource?.multiSourceExpression}
                onClose={() => setShowMultiSourcePopup(false)}
                onApply={handleApplyMultiSourceExpression}
            />

            <AddConstantModal
                isOpen={showAddConstantModal}
                onClose={() => setShowAddConstantModal(false)}
                onAdd={(constant) => {
                    addConstant(constant);
                    setShowAddConstantModal(false);
                }}
            />

            <AddTargetFieldModal
                isOpen={showAddTargetFieldModal}
                onClose={() => setShowAddTargetFieldModal(false)}
                onAdd={(field) => {
                    addCustomTargetField(field);
                    setShowAddTargetFieldModal(false);
                }}
            />

            <Modal
                variant={ModalVariant.small}
                title="Clear All Mappings?"
                isOpen={showClearMappingsConfirm}
                onClose={() => setShowClearMappingsConfirm(false)}
                actions={[
                    <Button key="confirm" variant="danger" onClick={() => {
                        clearMappings();
                        setShowClearMappingsConfirm(false);
                    }}>
                        Clear Mappings
                    </Button>,
                    <Button key="cancel" variant="link" onClick={() => setShowClearMappingsConfirm(false)}>
                        Cancel
                    </Button>,
                ]}
            >
                Are you sure you want to clear all field mappings? This action cannot be undone.
            </Modal>

            <Modal
                variant={ModalVariant.small}
                title="Reset Everything?"
                isOpen={showResetAllConfirm}
                onClose={() => setShowResetAllConfirm(false)}
                actions={[
                    <Button key="confirm" variant="danger" onClick={() => {
                        setSourceSchema(undefined);
                        setTargetSchema(undefined);
                        clearMappings();
                        setShowResetAllConfirm(false);
                    }}>
                        Reset All
                    </Button>,
                    <Button key="cancel" variant="link" onClick={() => setShowResetAllConfirm(false)}>
                        Cancel
                    </Button>,
                ]}
            >
                Are you sure you want to reset everything? This will remove source schema, target schema, and all mappings. This action cannot be undone.
            </Modal>

            {showListMappingModal && selectedFieldForListMapping && (
                <ListMappingModal
                    isOpen={showListMappingModal}
                    onClose={() => setShowListMappingModal(false)}
                    sourceField={sourceSchema?.fields.find(f => f.id === selectedFieldForListMapping)!}
                    targetField={targetSchema?.fields.find(f => f.id === selectedFieldForListMapping)!}
                    listMappingConfig={listMappingConfigs.find(config => 
                        config.sourceArrayPath === sourceSchema?.fields.find(f => f.id === selectedFieldForListMapping)?.path
                    )}
                    onSave={(config) => {
                        addListMappingConfig(config);
                        setShowListMappingModal(false);
                    }}
                />
            )}
        </PageSection>
    );
}
