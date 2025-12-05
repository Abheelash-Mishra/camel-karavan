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
    const [parameters, setParameters] = useState(
        currentMapping?.transformation?.parameters?.join(', ') || ''
    );

    React.useEffect(() => {
        setSelectedFunction(currentMapping?.transformation?.name || '');
        setParameters(currentMapping?.transformation?.parameters?.join(', ') || '');
    }, [currentMapping, isOpen]);

    const handleApply = () => {
        if (!selectedFunction) {
            onApply(undefined);
        } else {
            const transformation: TransformationFunction = {
                name: selectedFunction,
                parameters: parameters ? parameters.split(',').map((p: string) => p.trim()).filter((p: string) => p) : undefined,
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

                        <FormGroup 
                            label="Parameters" 
                            fieldId="parameters"
                            style={{ marginTop: '8px' }}
                        >
                            <TextArea
                                id="parameters"
                                value={parameters}
                                onChange={(_event, value) => setParameters(value)}
                                placeholder='Enter parameters separated by commas, e.g., ",", 0, 5'
                                rows={2}
                            />
                            <HelperText>
                                <HelperTextItem>
                                    Enter additional parameters separated by commas (first parameter is the field value)
                                </HelperTextItem>
                            </HelperText>
                        </FormGroup>
                    </>
                )}
            </Form>
        </Modal>
    );
}
