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
import { Alert, AlertActionCloseButton, AlertGroup } from '@patternfly/react-core';
import { ValidationWarning } from './DataMapperTypes';

interface ValidationWarningPanelProps {
    warnings: ValidationWarning[];
    onDismiss: (warningId: string) => void;
    onDismissAll: () => void;
}

export function ValidationWarningPanel({ warnings, onDismiss, onDismissAll }: ValidationWarningPanelProps) {
    if (warnings.length === 0) {
        return null;
    }

    return (
        <div className="validation-warning-panel">
            <AlertGroup isToast>
                {warnings.map(warning => (
                    <Alert
                        key={warning.id}
                        variant={warning.severity === 'error' ? 'danger' : warning.severity === 'warning' ? 'warning' : 'info'}
                        title={warning.line ? `Line ${warning.line}` : 'JSLT Validation'}
                        actionClose={
                            <AlertActionCloseButton onClose={() => onDismiss(warning.id)} />
                        }
                        isInline
                    >
                        {warning.message}
                    </Alert>
                ))}
            </AlertGroup>
        </div>
    );
}
