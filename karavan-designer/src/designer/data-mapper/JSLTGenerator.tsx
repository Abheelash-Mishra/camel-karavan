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

import React, {useMemo} from "react";
import {
    Button,
    CodeBlock,
    CodeBlockCode,
    Modal,
    ModalVariant,
    Text,
    TextContent,
    TextVariants,
} from "@patternfly/react-core";
import {ConstantEntry, MappingDescriptor} from "./types";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    mappings: MappingDescriptor[];
    constants: ConstantEntry[];
}

interface JsltLine {
    target: string;
    expression: string;
}

function toPath(path: string[]): string {
    return path.reduce((acc, segment) => segment === "[]" ? `${acc}[]` : acc ? `${acc}.${segment}` : segment, "");
}

function buildJsltLines(mappings: MappingDescriptor[], constants: ConstantEntry[]): JsltLine[] {
    const constantById = new Map(constants.map(c => [c.id, c.value] as const));
    return mappings.map(mapping => {
        if (mapping.kind === "constant" && mapping.constantId) {
            const value = constantById.get(mapping.constantId) ?? "";
            return {
                target: toPath(mapping.targetPath),
                expression: JSON.stringify(value),
            };
        }
        const source = mapping.sourcePath ? toPath(mapping.sourcePath) : "";
        return {
            target: toPath(mapping.targetPath),
            expression: source ? `.${source}` : "null",
        };
    }).sort((a, b) => a.target.localeCompare(b.target));
}

function buildJsltSpec(mappings: MappingDescriptor[], constants: ConstantEntry[]): string {
    const lines = buildJsltLines(mappings, constants);
    if (lines.length === 0) {
        return "{\n  // Add mappings to generate a JSLT specification\n}";
    }
    const body = lines
        .map(line => `  "${line.target}": ${line.expression}`)
        .join(",\n");
    return `{\n${body}\n}`;
}

export function JSLTGenerator(props: Props) {
    const spec = useMemo(() => buildJsltSpec(props.mappings, props.constants), [props.mappings, props.constants]);

    return (
        <Modal
            variant={ModalVariant.large}
            title="Generated JSLT Specification"
            isOpen={props.isOpen}
            onClose={props.onClose}
            actions={[
                <Button key="close" variant="primary" onClick={props.onClose}>Close</Button>,
            ]}
        >
            <TextContent>
                <Text component={TextVariants.p}>
                    This preview is a starting point based on the current field mappings. Review and adapt it before exporting.
                </Text>
            </TextContent>
            <CodeBlock>
                <CodeBlockCode id="jslt-preview">
                    {spec}
                </CodeBlockCode>
            </CodeBlock>
        </Modal>
    );
}
