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

import { v4 as uuidv4 } from 'uuid';
import { FieldDefinition, FieldMapping, ValidationWarning, SchemaData } from './DataMapperTypes';

export class JsltParser {
    
    /**
     * Parse JSLT spec and extract mappings
     */
    static parse(
        jslt: string,
        sourceSchema?: SchemaData,
        targetSchema?: SchemaData
    ): {
        mappings: FieldMapping[];
        warnings: ValidationWarning[];
        inferredSourceFields?: FieldDefinition[];
        inferredTargetFields?: FieldDefinition[];
    } {
        const mappings: FieldMapping[] = [];
        const warnings: ValidationWarning[] = [];

        if (!jslt || jslt.trim() === '' || jslt.trim() === '.') {
            warnings.push({
                id: uuidv4(),
                message: 'JSLT spec is empty or contains only root reference',
                severity: 'info',
            });
            return { mappings, warnings };
        }

        try {
            // Parse simple field mappings
            const fieldMappings = this.extractFieldMappings(jslt, sourceSchema, targetSchema);
            mappings.push(...fieldMappings.mappings);
            warnings.push(...fieldMappings.warnings);

            // Check for complex expressions that can't be visualized
            const complexExpressions = this.findComplexExpressions(jslt);
            complexExpressions.forEach((expr, index) => {
                warnings.push({
                    id: uuidv4(),
                    message: `Complex JSLT expression found: ${expr.substring(0, 50)}... - May not be fully visualized`,
                    line: this.findLineNumber(jslt, expr),
                    severity: 'warning',
                });
            });

        } catch (error) {
            warnings.push({
                id: uuidv4(),
                message: `Error parsing JSLT: ${error}`,
                severity: 'error',
            });
        }

        return {
            mappings,
            warnings,
        };
    }

    /**
     * Extract field-to-field mappings from JSLT
     */
    private static extractFieldMappings(
        jslt: string,
        sourceSchema?: SchemaData,
        targetSchema?: SchemaData
    ): { mappings: FieldMapping[]; warnings: ValidationWarning[] } {
        const mappings: FieldMapping[] = [];
        const warnings: ValidationWarning[] = [];

        // Simple regex to find field assignments
        // Pattern: "targetField": .sourceField or "targetField": function(.sourceField)
        const assignmentPattern = /"([^"]+)"\s*:\s*([^,\n}]+)/g;
        let match: RegExpExecArray | null;

        const sourceFields = sourceSchema ? sourceSchema.fields : [];
        const targetFields = targetSchema ? targetSchema.fields : [];

        while ((match = assignmentPattern.exec(jslt)) !== null) {
            const targetFieldName = match[1];
            const expression = match[2].trim();

            // Find target field
            const targetField = this.findFieldByName(targetFields, targetFieldName);
            if (!targetField) {
                warnings.push({
                    id: uuidv4(),
                    message: `Target field "${targetFieldName}" not found in schema`,
                    line: match ? this.findLineNumber(jslt, match[0]) : undefined,
                    severity: 'warning',
                });
                continue;
            }

            // Extract source field(s) from expression
            const sourceFieldPaths = this.extractSourcePaths(expression);
            
            if (sourceFieldPaths.length === 0) {
                warnings.push({
                    id: uuidv4(),
                    message: `Could not extract source field from expression: ${expression}`,
                    line: match ? this.findLineNumber(jslt, match[0]) : undefined,
                    severity: 'warning',
                });
                continue;
            }

            // Find source fields
            const sourceFieldIds: string[] = [];
            sourceFieldPaths.forEach(path => {
                const sourceField = this.findFieldByPath(sourceFields, path);
                if (sourceField) {
                    sourceFieldIds.push(sourceField.id);
                } else {
                    warnings.push({
                        id: uuidv4(),
                        message: `Source field "${path}" not found in schema`,
                        line: match ? this.findLineNumber(jslt, match[0]) : undefined,
                        severity: 'warning',
                    });
                }
            });

            if (sourceFieldIds.length > 0) {
                // Detect transformation function
                const transformation = this.extractTransformation(expression);
                
                const mapping: FieldMapping = {
                    id: uuidv4(),
                    sourceFieldIds,
                    targetFieldId: targetField.id,
                    transformation,
                    multiSourceExpression: sourceFieldIds.length > 1 ? expression : undefined,
                };

                mappings.push(mapping);
            }
        }

        return { mappings, warnings };
    }

    /**
     * Extract source field paths from JSLT expression
     */
    private static extractSourcePaths(expression: string): string[] {
        const paths: string[] = [];
        
        // First, try to match .fieldPath patterns (e.g., .id, .name_first)
        const dotPathPattern = /\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*(?:\[\])?)/g;
        let match;

        while ((match = dotPathPattern.exec(expression)) !== null) {
            const path = match[1];
            if (!paths.includes(path)) {
                paths.push(path);
            }
        }

        // If no dot paths found, try to match standalone field names in concatenation expressions
        // This handles cases like: id + " " + name_first
        if (paths.length === 0) {
            const standalonePattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
            while ((match = standalonePattern.exec(expression)) !== null) {
                const fieldName = match[1];
                // Skip common keywords and operators
                if (!['let', 'if', 'then', 'else', 'for', 'in', 'and', 'or', 'not', 'null', 'true', 'false'].includes(fieldName)) {
                    if (!paths.includes(fieldName)) {
                        paths.push(fieldName);
                    }
                }
            }
        }

        return paths;
    }

    /**
     * Extract transformation function from expression
     */
    private static extractTransformation(expression: string): { name: string; parameters?: string[] } | undefined {
        // Match function calls: functionName(...)
        const funcPattern = /^([a-z]+)\(/;
        const match = funcPattern.exec(expression.trim());

        if (match) {
            const funcName = match[1];
            
            // Extract parameters (simplified - doesn't handle nested functions)
            const paramsMatch = expression.match(/\(([^)]+)\)/);
            if (paramsMatch) {
                const paramsStr = paramsMatch[1];
                // Split by comma, skip first parameter (usually the field reference)
                const params = paramsStr.split(',').slice(1).map(p => p.trim().replace(/^["']|["']$/g, ''));
                
                return {
                    name: funcName,
                    parameters: params.length > 0 ? params : undefined,
                };
            }

            return { name: funcName };
        }

        return undefined;
    }

    /**
     * Find complex expressions that may not be fully visualizable
     */
    private static findComplexExpressions(jslt: string): string[] {
        const complexExpressions: string[] = [];

        // Look for nested function calls
        const nestedFuncPattern = /[a-z]+\([^)]*[a-z]+\([^)]*\)[^)]*\)/g;
        let match;
        
        while ((match = nestedFuncPattern.exec(jslt)) !== null) {
            complexExpressions.push(match[0]);
        }

        // Look for conditional expressions (if-then-else)
        const conditionalPattern = /if\s*\([^)]+\)[^]*?else/g;
        while ((match = conditionalPattern.exec(jslt)) !== null) {
            complexExpressions.push(match[0]);
        }

        // Look for let expressions
        const letPattern = /let\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=/g;
        while ((match = letPattern.exec(jslt)) !== null) {
            complexExpressions.push(match[0]);
        }

        return complexExpressions;
    }

    /**
     * Find line number of text in JSLT
     */
    private static findLineNumber(jslt: string, text: string): number {
        const index = jslt.indexOf(text);
        if (index === -1) return 0;
        
        const beforeText = jslt.substring(0, index);
        return beforeText.split('\n').length;
    }

    /**
     * Find field by name in field list
     */
    private static findFieldByName(fields: FieldDefinition[], name: string): FieldDefinition | undefined {
        const flatFields = this.flattenFields(fields);
        return flatFields.find(f => f.name === name);
    }

    /**
     * Find field by path in field list
     */
    private static findFieldByPath(fields: FieldDefinition[], path: string): FieldDefinition | undefined {
        const flatFields = this.flattenFields(fields);
        // Try exact path match first
        let field = flatFields.find(f => f.path === path || f.path === path.replace(/\[\]/g, ''));
        
        // If not found, try matching by name (for standalone field names without dot prefix)
        if (!field) {
            field = flatFields.find(f => f.name === path);
        }
        
        return field;
    }

    /**
     * Flatten nested fields
     */
    private static flattenFields(fields: FieldDefinition[]): FieldDefinition[] {
        const result: FieldDefinition[] = [];
        
        const flatten = (field: FieldDefinition) => {
            result.push(field);
            if (field.children) {
                field.children.forEach(flatten);
            }
        };

        fields.forEach(flatten);
        return result;
    }
}
