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

import React, { useState } from 'react';
import {
    Modal,
    ModalVariant,
    Button,
    Form,
    FormGroup,
    FormSelect,
    FormSelectOption,
    TextArea,
    TextInput,
    Card,
    CardBody,
    CardTitle,
    Divider,
    Text,
    TextVariants,
    Grid,
    GridItem,
    HelperText,
    HelperTextItem,
} from '@patternfly/react-core';
import { ArrowRightIcon } from '@patternfly/react-icons';
import { JSLT_FUNCTIONS, TransformationFunction, FieldMapping, FieldDefinition } from './DataMapperTypes';

interface TransformationPopupProps {
    isOpen: boolean;
    currentMapping?: FieldMapping;
    sourceFields?: FieldDefinition[];
    targetFields?: FieldDefinition[];
    onClose: () => void;
    onApply: (transformation: TransformationFunction | undefined) => void;
    onEditMultiSource?: () => void;
}

export function TransformationPopup({ 
    isOpen, 
    currentMapping, 
    sourceFields = [],
    targetFields = [],
    onClose, 
    onApply,
    onEditMultiSource
}: TransformationPopupProps) {
    const [selectedFunction, setSelectedFunction] = useState(currentMapping?.transformation?.name || '');
    const [parameters, setParameters] = useState<string[]>(
        currentMapping?.transformation?.parameters || []
    );

    React.useEffect(() => {
        setSelectedFunction(currentMapping?.transformation?.name || '');
        setParameters(currentMapping?.transformation?.parameters || []);
    }, [currentMapping, isOpen]);

    const handleApply = () => {
        if (!selectedFunction) {
            onApply(undefined);
        } else {
            const transformation: TransformationFunction = {
                name: selectedFunction,
                parameters: parameters && parameters.length > 0 ? parameters.map(p => p?.toString()) : undefined,
            };
            onApply(transformation);
        }
        onClose();
    };

    const handleRemove = () => {
        onApply(undefined);
        onClose();
    };

    const selectedFunctionDef = JSLT_FUNCTIONS.find(f => f.name === selectedFunction);
    
    // Get source and target field details
    const sourceFieldDetails = currentMapping?.sourceFieldIds.map(id => 
        sourceFields.find(f => f.id === id)
    ).filter(Boolean) || [];
    
    const targetField = targetFields.find(f => f.id === currentMapping?.targetFieldId);

    // Detect array-specific context
    const involvesArray = !!(targetField && (targetField.type === 'array' || targetField.isArray)) ||
        (sourceFieldDetails.some(f => f && (f.type === 'array' || f.isArray)));
    const isArrayToArray = !!(targetField && (targetField.type === 'array' || targetField.isArray)) &&
        sourceFieldDetails.some(f => f && (f.type === 'array' || f.isArray));
    const [enableForLoop, setEnableForLoop] = useState<boolean>(isArrayToArray);

    return (
        <Modal
            variant={ModalVariant.medium}
            title="Mapping Details"
            isOpen={isOpen}
            onClose={onClose}
            actions={[
                <Button key="apply" variant="primary" onClick={handleApply}>
                    Apply
                </Button>,
                currentMapping?.transformation && (
                    <Button key="remove" variant="danger" onClick={handleRemove}>
                        Remove Transformation
                    </Button>
                ),
                <Button key="cancel" variant="link" onClick={onClose}>
                    Cancel
                </Button>,
            ].filter(Boolean)}
        >
            {/* Mapping Overview */}
            <Card isCompact className="mapping-overview-card">
                <CardTitle>
                    <Text component={TextVariants.h3}>Field Mapping</Text>
                </CardTitle>
                <CardBody>
                    <Grid hasGutter>
                        <GridItem span={5}>
                            <div className="mapping-field-info">
                                <Text component={TextVariants.small} className="field-label">Source Field{sourceFieldDetails.length > 1 ? 's' : ''}</Text>
                                {sourceFieldDetails.map((field, idx) => (
                                    <div key={idx} className="field-detail">
                                        <Text component={TextVariants.p}>
                                            <strong>{field?.name}</strong>
                                            <span className="field-type-badge">{field?.type}</span>
                                        </Text>
                                        <Text component={TextVariants.small} className="field-path">{field?.path}</Text>
                                    </div>
                                ))}
                            </div>
                        </GridItem>
                        <GridItem span={2} className="mapping-arrow-container">
                            <ArrowRightIcon />
                        </GridItem>
                        <GridItem span={5}>
                            <div className="mapping-field-info">
                                <Text component={TextVariants.small} className="field-label">Target Field</Text>
                                <div className="field-detail">
                                    <Text component={TextVariants.p}>
                                        <strong>{targetField?.name}</strong>
                                        <span className="field-type-badge">{targetField?.type}</span>
                                    </Text>
                                    <Text component={TextVariants.small} className="field-path">{targetField?.path}</Text>
                                </div>
                            </div>
                        </GridItem>
                    </Grid>
                </CardBody>
            </Card>

            <Divider style={{ margin: '12px 0' }} />

            {/* Multi-Source Expression */}
            {currentMapping && currentMapping.sourceFieldIds.length > 1 && (
                <>
                    <Form>
                        <Text component={TextVariants.h4} style={{ marginBottom: '8px' }}>
                            Multi-Source Expression
                        </Text>
                        <HelperText>
                            <HelperTextItem>
                                Combine multiple source fields using an expression
                            </HelperTextItem>
                        </HelperText>

                        <FormGroup 
                            label="Expression" 
                            fieldId="multi-source-expression"
                            style={{ marginTop: '8px' }}
                        >
                            <TextArea
                                id="multi-source-expression"
                                value={currentMapping.multiSourceExpression || 'No expression defined'}
                                readOnly
                                rows={2}
                            />
                            <HelperText>
                                <HelperTextItem>
                                    <Button 
                                        variant="link" 
                                        isInline 
                                        onClick={() => {
                                            if (onEditMultiSource) {
                                                onClose();
                                                onEditMultiSource();
                                            }
                                        }}
                                    >
                                        Edit Expression
                                    </Button>
                                </HelperTextItem>
                            </HelperText>
                        </FormGroup>
                    </Form>
                    <Divider style={{ margin: '12px 0' }} />
                </>
            )}

            {/* Array Mapping Configuration */}
            {involvesArray && (
                <Form style={{ marginBottom: '12px' }}>
                    <Text component={TextVariants.h4} style={{ marginBottom: '8px' }}>
                        Array Mapping
                    </Text>
                    <HelperText>
                        <HelperTextItem>
                            {isArrayToArray
                                ? 'Map array items using a for-loop or index access.'
                                : 'Apply array-specific operations (index access) to source or target.'}
                        </HelperTextItem>
                    </HelperText>
                    <FormGroup label="Use for-loop" fieldId="array-for-loop" style={{ marginTop: 8 }}>
                        <Button
                            variant={enableForLoop ? 'primary' : 'secondary'}
                            onClick={() => setEnableForLoop(!enableForLoop)}
                        >
                            {enableForLoop ? 'Enabled' : 'Disabled'}
                        </Button>
                        <HelperText>
                            <HelperTextItem>
                                When enabled, the generated JSLT will use [for (...)] on the source array and map item fields.
                            </HelperTextItem>
                        </HelperText>
                    </FormGroup>
                </Form>
            )}

            {/* Transformation Configuration */}
            <Form>
                <Text component={TextVariants.h4} style={{ marginBottom: '8px' }}>
                    Transformation Function
                </Text>
                <HelperText>
                    <HelperTextItem>
                        Apply a JSLT function to transform source field values before mapping to target
                    </HelperTextItem>
                </HelperText>

                <FormGroup 
                    label="Function" 
                    fieldId="function-select"
                    style={{ marginTop: '8px' }}
                >
                    <FormSelect
                        value={selectedFunction}
                        onChange={(_event, value) => setSelectedFunction(value)}
                        id="function-select"
                    >
                        <FormSelectOption key="none" value="" label="No transformation" />
                        {JSLT_FUNCTIONS.map(func => (
                            <FormSelectOption 
                                key={func.name} 
                                value={func.name} 
                                label={`${func.name}() - ${func.description}`}
                            />
                        ))}
                    </FormSelect>
                </FormGroup>

                {selectedFunction && selectedFunctionDef && (
                    <>
                        <HelperText style={{ marginTop: '4px' }}>
                            <HelperTextItem variant="indeterminate">
                                <strong>Example:</strong> {selectedFunctionDef.example}
                            </HelperTextItem>
                        </HelperText>
                        {selectedFunctionDef.params && selectedFunctionDef.params.length > 0 ? (
                            <>
                                {selectedFunctionDef.params.map((p, idx) => (
                                    <FormGroup key={p.name} label={p.name} fieldId={`param-${idx}`} style={{ marginTop: 8 }}>
                                        <TextInput
                                            id={`param-${idx}`}
                                            value={(parameters[idx] ?? p.default) || ''}
                                            onChange={(value: any, event?: any) => {
                                                // PatternFly/TextInput onChange may pass either:
                                                // - (value: string, event)
                                                // - (event) where the event is the first arg
                                                let v: string;
                                                if (typeof value === 'string') {
                                                    v = value;
                                                } else if (value && (value.currentTarget || value.target)) {
                                                    // value is an event-like object
                                                    const tgt = (value.currentTarget || value.target) as any;
                                                    v = tgt && typeof tgt.value === 'string' ? tgt.value : String(tgt && tgt.value || '');
                                                } else if (event && (event.currentTarget || event.target)) {
                                                    const tgt = (event.currentTarget || event.target) as any;
                                                    v = tgt && typeof tgt.value === 'string' ? tgt.value : String(tgt && tgt.value || '');
                                                } else {
                                                    v = String(value == null ? '' : value);
                                                }

                                                const next = [...parameters];
                                                next[idx] = v;
                                                setParameters(next);
                                            }}
                                            placeholder={p.placeholder || ''}
                                        />
                                        <HelperText>
                                            <HelperTextItem>
                                                {p.description}
                                            </HelperTextItem>
                                        </HelperText>
                                    </FormGroup>
                                ))}
                            </>
                        ) : (
                            <HelperText style={{ marginTop: '8px' }}>
                                <HelperTextItem>
                                    This function does not require additional parameters.
                                </HelperTextItem>
                            </HelperText>
                        )}
                    </>
                )}
            </Form>
        </Modal>
    );
}
