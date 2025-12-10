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
import Editor from '@monaco-editor/react';
import {
    Modal,
    ModalVariant,
    Button,
    Alert,
} from '@patternfly/react-core';
import { DownloadIcon } from '@patternfly/react-icons';

interface JsltEditorModalProps {
    isOpen: boolean;
    jslt: string;
    onClose: () => void;
    onApply: (jslt: string) => void;
}

export function JsltEditorModal({ isOpen, jslt, onClose, onApply }: JsltEditorModalProps) {
    const [editedJslt, setEditedJslt] = useState(jslt);
    const [error, setError] = useState<string>();

    React.useEffect(() => {
        setEditedJslt(jslt);
        setError(undefined);
    }, [jslt, isOpen]);

    const handleDownload = () => {
        const blob = new Blob([editedJslt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mapping.jslt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleApply = () => {
        try {
            // Basic validation - check balanced braces
            const openBraces = (editedJslt.match(/{/g) || []).length;
            const closeBraces = (editedJslt.match(/}/g) || []).length;
            const openBrackets = (editedJslt.match(/\[/g) || []).length;
            const closeBrackets = (editedJslt.match(/]/g) || []).length;

            if (openBraces !== closeBraces) {
                setError('Unbalanced curly braces');
                return;
            }

            if (openBrackets !== closeBrackets) {
                setError('Unbalanced square brackets');
                return;
            }

            onApply(editedJslt);
            onClose();
        } catch (e) {
            setError(`Error: ${e}`);
        }
    };

    return (
        <Modal
            variant={ModalVariant.large}
            title="Edit JSLT Specification"
            isOpen={isOpen}
            onClose={onClose}
            actions={[
                <Button key="download" variant="secondary" icon={<DownloadIcon />} onClick={handleDownload}>
                    Download JSLT
                </Button>,
                <Button key="apply" variant="primary" onClick={handleApply}>
                    Apply & Close
                </Button>,
                <Button key="cancel" variant="link" onClick={onClose}>
                    Cancel
                </Button>,
            ]}
        >
            {error && (
                <Alert variant="danger" title="Validation Error" style={{ marginBottom: 16 }}>
                    {error}
                </Alert>
            )}
            
            <div style={{ height: '500px', border: '1px solid #d2d2d2' }}>
                <Editor
                    height="100%"
                    defaultLanguage="plaintext"
                    theme="light"
                    value={editedJslt}
                    onChange={(value) => setEditedJslt(value || '')}
                    options={{
                        minimap: { enabled: false },
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        fontSize: 13,
                        wordWrap: 'on',
                    }}
                />
            </div>
        </Modal>
    );
}
