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
    TextInput,
    FormSelect,
    FormSelectOption,
} from '@patternfly/react-core';
import { v4 as uuidv4 } from 'uuid';
import { ConstantValue, FieldType } from './DataMapperTypes';

interface AddConstantModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (constant: ConstantValue) => void;
}

export function AddConstantModal({ isOpen, onClose, onAdd }: AddConstantModalProps) {
    const [name, setName] = useState('');
    const [value, setValue] = useState('');
    const [type, setType] = useState<FieldType>('string');

    const handleAdd = () => {
        if (name.trim() && value.trim()) {
            const constant: ConstantValue = {
                id: `const_${uuidv4()}`,
                name: name.trim(),
                value: value.trim(),
                type,
            };
            onAdd(constant);
            handleClose();
        }
    };

    const handleClose = () => {
        setName('');
        setValue('');
        setType('string');
        onClose();
    };

    return (
        <Modal
            variant={ModalVariant.small}
            title="Add Constant Value"
            isOpen={isOpen}
            onClose={handleClose}
            actions={[
                <Button key="add" variant="primary" onClick={handleAdd} isDisabled={!name.trim() || !value.trim()}>
                    Add
                </Button>,
                <Button key="cancel" variant="link" onClick={handleClose}>
                    Cancel
                </Button>,
            ]}
        >
            <Form>
                <FormGroup label="Name" fieldId="constant-name" isRequired>
                    <TextInput
                        id="constant-name"
                        value={name}
                        onChange={(_event, value) => setName(value)}
                        placeholder="e.g., DEFAULT_STATUS"
                    />
                </FormGroup>

                <FormGroup label="Value" fieldId="constant-value" isRequired>
                    <TextInput
                        id="constant-value"
                        value={value}
                        onChange={(_event, value) => setValue(value)}
                        placeholder="e.g., active"
                    />
                </FormGroup>

                <FormGroup label="Type" fieldId="constant-type">
                    <FormSelect
                        id="constant-type"
                        value={type}
                        onChange={(_event, value) => setType(value as FieldType)}
                    >
                        <FormSelectOption value="string" label="String" />
                        <FormSelectOption value="number" label="Number" />
                        <FormSelectOption value="boolean" label="Boolean" />
                    </FormSelect>
                </FormGroup>
            </Form>
        </Modal>
    );
}
