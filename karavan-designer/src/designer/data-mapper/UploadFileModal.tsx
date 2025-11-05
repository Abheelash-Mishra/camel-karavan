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
    FileUpload,
    ToggleGroup,
    ToggleGroupItem,
} from '@patternfly/react-core';
import { SchemaType } from './DataMapperTypes';

interface UploadFileModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    onUpload: (content: any, schemaType: SchemaType, fileName: string) => void;
}

export function UploadFileModal({ isOpen, title, onClose, onUpload }: UploadFileModalProps) {
    const [fileName, setFileName] = useState('');
    const [fileContent, setFileContent] = useState('');
    const [schemaType, setSchemaType] = useState<SchemaType>('json-instance');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>();

    const handleFileInputChange = (_event: any, file: File) => {
        setFileName(file.name);
        setError(undefined);
    };

    const handleFileRead = (fileHandle: File) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(fileHandle);
        });
    };

    const handleTextOrDataChange = (_event: any, value: string) => {
        setFileContent(value);
        setError(undefined);
    };

    const handleSave = () => {
        if (!fileContent || fileContent.trim() === '') {
            setError('Please upload a file or paste JSON content');
            return;
        }

        try {
            const jsonContent = JSON.parse(fileContent);
            onUpload(jsonContent, schemaType, fileName || 'schema.json');
            handleClose();
        } catch (e) {
            setError(`Invalid JSON: ${e}`);
        }
    };

    const handleClose = () => {
        setFileName('');
        setFileContent('');
        setSchemaType('json-instance');
        setError(undefined);
        onClose();
    };

    const accept = {
        'application/json': ['.json'],
    };

    return (
        <Modal
            variant={ModalVariant.medium}
            title={title}
            isOpen={isOpen}
            onClose={handleClose}
            actions={[
                <Button key="upload" variant="primary" onClick={handleSave}>
                    Upload
                </Button>,
                <Button key="cancel" variant="link" onClick={handleClose}>
                    Cancel
                </Button>,
            ]}
        >
            <Form>
                <FormGroup label="Schema Type" fieldId="schema-type">
                    <ToggleGroup>
                        <ToggleGroupItem
                            text="Sample JSON"
                            isSelected={schemaType === 'json-instance'}
                            onChange={() => setSchemaType('json-instance')}
                        />
                        <ToggleGroupItem
                            text="JSON Schema"
                            isSelected={schemaType === 'json-schema'}
                            onChange={() => setSchemaType('json-schema')}
                        />
                    </ToggleGroup>
                </FormGroup>

                <FormGroup 
                    label="Upload File" 
                    fieldId="file-upload"
                >
                    <FileUpload
                        id="file-upload"
                        value={fileContent}
                        filename={fileName}
                        type="text"
                        hideDefaultPreview
                        browseButtonText="Browse"
                        isLoading={isLoading}
                        onFileInputChange={handleFileInputChange}
                        onDataChange={handleTextOrDataChange}
                        onReadStarted={() => setIsLoading(true)}
                        onReadFinished={() => setIsLoading(false)}
                        onClearClick={() => {
                            setFileName('');
                            setFileContent('');
                        }}
                        dropzoneProps={{ accept }}
                    />
                </FormGroup>
            </Form>
        </Modal>
    );
}
