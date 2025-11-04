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

import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Chip,
    ChipGroup,
    Divider,
    EmptyState,
    EmptyStateBody,
    EmptyStateIcon,
    Flex,
    Form,
    FormGroup,
    Modal,
    ModalVariant,
    Text,
    TextArea,
    TextContent,
    TextInput,
    TextVariants,
    Tooltip
} from "@patternfly/react-core";
import UploadIcon from '@patternfly/react-icons/dist/esm/icons/upload-icon';
import AngleRightIcon from '@patternfly/react-icons/dist/esm/icons/angle-right-icon';
import AngleDownIcon from '@patternfly/react-icons/dist/esm/icons/angle-down-icon';
import OutlinedFileIcon from '@patternfly/react-icons/dist/esm/icons/file-alt-icon';
import CodeIcon from '@patternfly/react-icons/dist/esm/icons/code-icon';
import InProgressIcon from '@patternfly/react-icons/dist/esm/icons/in-progress-icon';
import TimesIcon from '@patternfly/react-icons/dist/esm/icons/times-icon';
import PlusCircleIcon from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import InfoCircleIcon from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import "./data-mapper.css";
import {ConstantEntry, MappingDescriptor} from "./types";
import {JSLTGenerator} from "./JSLTGenerator";

type NodeType = "object" | "array" | "value";

interface SchemaNode {
    id: string;
    name: string;
    displayName: string;
    path: string[];
    type: NodeType;
    valueType?: string;
    children: SchemaNode[];
    isLeaf: boolean;
}

interface ColumnState {
    json: string;
    error?: string;
    tree?: SchemaNode;
}

interface MappingLine {
    id: string;
    d: string;
}

type ColumnKey = "source" | "target";

const DRAG_FORMAT = "application/x-karavan-data-mapper";

const getPathKey = (path: string[]) => path.reduce((acc, segment) => {
    if (segment === "[]") {
        return acc + "[]";
    }
    return acc ? `${acc}.${segment}` : segment;
}, "");

export interface DataMapperProps {
    onSourceJsonChange?: (json: string) => void;
    onTargetJsonChange?: (json: string) => void;
    onMappingsChange?: (mappings: MappingDescriptor[]) => void;
}

export function DataMapper(props: DataMapperProps) {
    const [source, setSource] = useState<ColumnState>({json: ""});
    const [target, setTarget] = useState<ColumnState>({json: ""});
    const [constants, setConstants] = useState<ConstantEntry[]>([]);
    const [newConstantName, setNewConstantName] = useState<string>("");
    const [newConstantValue, setNewConstantValue] = useState<string>("");
    const [showConstantForm, setShowConstantForm] = useState<boolean>(false);
    const [expandedNodes, setExpandedNodes] = useState<Record<ColumnKey, Set<string>>>(() => ({
        source: new Set<string>(),
        target: new Set<string>()
    }));
    const [activeDropPath, setActiveDropPath] = useState<string>();
    const [mappings, setMappings] = useState<Record<string, MappingDescriptor>>({});
    const [jsonEditor, setJsonEditor] = useState<{column: ColumnKey, value: string}>();
    const [connections, setConnections] = useState<MappingLine[]>([]);
    const [showGenerator, setShowGenerator] = useState<boolean>(false);

    const sourceInputRef = useRef<HTMLInputElement>(null);
    const targetInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const scrollAnimation = useRef<number>();
    const anchorRefs = useRef<{
        source: Record<string, HTMLDivElement | null>,
        target: Record<string, HTMLDivElement | null>
    }>({source: {}, target: {}});
    const constantRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const sourceNodes = useMemo(() => source.tree ? source.tree.children : [], [source.tree]);
    const targetNodes = useMemo(() => target.tree ? target.tree.children : [], [target.tree]);

    const buildSchema = useCallback((value: unknown, name: string, path: string[]): SchemaNode => {
        const id = getPathKey(path);
        const node: SchemaNode = {
            id,
            name,
            displayName: name,
            path,
            type: "value",
            children: [],
            isLeaf: true,
        };
        if (Array.isArray(value)) {
            node.type = "array";
            node.valueType = value.length > 0 ? typeof value[0] : "unknown";
            if (value.length > 0) {
                const child = buildSchema(value[0], "[item]", [...path, "[]"]);
                node.children = [child];
            }
        } else if (value !== null && typeof value === "object") {
            node.type = "object";
            node.children = Object.keys(value as Record<string, unknown>)
                .sort()
                .map(key => buildSchema((value as Record<string, unknown>)[key], key, [...path, key]));
        } else {
            node.type = "value";
            node.valueType = value === null ? "null" : typeof value;
        }
        node.isLeaf = node.type === "value" || (node.type === "array" && node.children.length === 0);
        return node;
    }, []);

    const collectExpandableNodes = useCallback((node: SchemaNode, bucket: Set<string>, depth: number) => {
        if (node.children.length > 0 || node.type === "array") {
            if (depth < 2) {
                bucket.add(node.id);
            }
            node.children.forEach(child => collectExpandableNodes(child, bucket, depth + 1));
        }
    }, []);

    const parseJson = useCallback((raw: string, column: ColumnKey): {tree?: SchemaNode, error?: string} => {
        if (!raw.trim()) {
            return {tree: undefined, error: undefined};
        }
        try {
            const parsed = JSON.parse(raw);
            const root = buildSchema(parsed, "root", []);
            const expanded = new Set<string>();
            collectExpandableNodes(root, expanded, 0);
            setExpandedNodes(prev => ({
                ...prev,
                [column]: expanded,
            }));
            return {tree: root, error: undefined};
        } catch (e) {
            const message = e instanceof Error ? e.message : "Unable to parse JSON";
            return {tree: undefined, error: message};
        }
    }, [buildSchema, collectExpandableNodes]);

    const handleDragStart = useCallback((event: React.DragEvent, payload: MappingDescriptor) => {
        event.dataTransfer.setData(DRAG_FORMAT, JSON.stringify(payload));
        event.dataTransfer.effectAllowed = "copy";
    }, []);

    const ensureTargetIsDroppable = useCallback((node: SchemaNode): boolean => {
        return node.isLeaf || (node.type === "array" && node.children.length === 0);
    }, []);

    const removeMapping = useCallback((targetPath: string[]) => {
        const key = getPathKey(targetPath);
        if (!mappings[key]) {
            return;
        }
        const next = {...mappings};
        delete next[key];
        setMappings(next);
        props.onMappingsChange?.(Object.values(next));
    }, [mappings, props]);

    const registerAnchor = useCallback((column: ColumnKey, nodeId: string, element: HTMLDivElement | null) => {
        if (element) {
            anchorRefs.current[column][nodeId] = element;
        } else {
            delete anchorRefs.current[column][nodeId];
        }
    }, []);

    const registerConstant = useCallback((id: string, element: HTMLDivElement | null) => {
        if (element) {
            constantRefs.current[id] = element;
        } else {
            delete constantRefs.current[id];
        }
    }, []);

    const computeConnections = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const bounds = canvas.getBoundingClientRect();
        const lines: MappingLine[] = [];
        Object.values(mappings).forEach(mapping => {
            const targetEl = anchorRefs.current.target[getPathKey(mapping.targetPath)];
            if (!targetEl) {
                return;
            }
            let startEl: HTMLDivElement | null | undefined;
            if (mapping.kind === "source" && mapping.sourcePath) {
                startEl = anchorRefs.current.source[getPathKey(mapping.sourcePath)];
            } else if (mapping.kind === "constant" && mapping.constantId) {
                startEl = constantRefs.current[mapping.constantId];
            }
            if (!startEl) {
                return;
            }
            const sourceRect = startEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            const startX = sourceRect.right - bounds.left;
            const startY = sourceRect.top + sourceRect.height / 2 - bounds.top;
            const endX = targetRect.left - bounds.left;
            const endY = targetRect.top + targetRect.height / 2 - bounds.top;
            const midX = startX + (endX - startX) / 2;
            const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
            lines.push({id: getPathKey(mapping.targetPath), d: path});
        });
        setConnections(lines);
    }, [mappings]);

    const scheduleConnections = useCallback(() => {
        if (scrollAnimation.current) {
            cancelAnimationFrame(scrollAnimation.current);
        }
        scrollAnimation.current = requestAnimationFrame(() => {
            computeConnections();
        });
    }, [computeConnections]);

    const applyJsonChange = useCallback((column: ColumnKey, rawText: string): boolean => {
        const update = column === "source" ? setSource : setTarget;
        const notify = column === "source" ? props.onSourceJsonChange : props.onTargetJsonChange;
        if (!rawText.trim()) {
            update({json: "", error: undefined, tree: undefined});
            notify?.("");
            scheduleConnections();
            return true;
        }
        try {
            const parsed = JSON.parse(rawText);
            const pretty = JSON.stringify(parsed, null, 2);
            const {tree} = parseJson(pretty, column);
            update({json: pretty, tree, error: undefined});
            notify?.(pretty);
            scheduleConnections();
            return true;
        } catch (e) {
            const message = e instanceof Error ? e.message : "Unable to parse JSON";
            update({json: rawText, error: message, tree: undefined});
            scheduleConnections();
            return false;
        }
    }, [parseJson, props.onSourceJsonChange, props.onTargetJsonChange, scheduleConnections]);

    const handleFileSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>, column: ColumnKey) => {
        const input = event.target;
        const file = input.files?.[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const text = typeof reader.result === "string" ? reader.result : "";
            applyJsonChange(column, text);
            input.value = "";
        };
        reader.onerror = () => {
            input.value = "";
        };
        reader.readAsText(file);
    }, [applyJsonChange]);

    useLayoutEffect(() => {
        computeConnections();
    }, [computeConnections, sourceNodes, targetNodes, expandedNodes]);

    useEffect(() => {
        window.addEventListener("resize", scheduleConnections);
        return () => {
            window.removeEventListener("resize", scheduleConnections);
            if (scrollAnimation.current) {
                cancelAnimationFrame(scrollAnimation.current);
            }
        };
    }, [scheduleConnections]);

    const handleDrop = useCallback((event: React.DragEvent, targetNode: SchemaNode) => {
        event.preventDefault();
        setActiveDropPath(undefined);
        const raw = event.dataTransfer.getData(DRAG_FORMAT);
        if (!raw || !ensureTargetIsDroppable(targetNode)) {
            return;
        }
        try {
            const payload = JSON.parse(raw) as MappingDescriptor;
            const descriptor: MappingDescriptor = {
                targetPath: targetNode.path,
                kind: payload.kind,
                sourcePath: payload.sourcePath,
                constantId: payload.constantId,
            };
            const key = getPathKey(targetNode.path);
            const next = {...mappings, [key]: descriptor};
            setMappings(next);
            props.onMappingsChange?.(Object.values(next));
            scheduleConnections();
        } catch (e) {
            console.error("Failed to parse drag payload", e);
        }
    }, [ensureTargetIsDroppable, mappings, props, scheduleConnections]);

    const handleDragOver = useCallback((event: React.DragEvent, node: SchemaNode) => {
        if (!ensureTargetIsDroppable(node)) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setActiveDropPath(node.id);
    }, [ensureTargetIsDroppable]);

    const handleDragLeave = useCallback((event: React.DragEvent, node: SchemaNode) => {
        if (activeDropPath === node.id) {
            event.preventDefault();
            setActiveDropPath(undefined);
        }
    }, [activeDropPath]);

    const toggleNode = useCallback((column: ColumnKey, node: SchemaNode) => {
        setExpandedNodes(prev => {
            const set = new Set(prev[column]);
            if (set.has(node.id)) {
                set.delete(node.id);
            } else {
                set.add(node.id);
            }
            return {...prev, [column]: set};
        });
        scheduleConnections();
    }, [scheduleConnections]);

    const handleTreeScroll = useCallback(() => {
        scheduleConnections();
    }, [scheduleConnections]);

    const renderMappingChip = useCallback((mapping: MappingDescriptor, onRemove: () => void) => {
        if (mapping.kind === "constant") {
            const constant = constants.find(item => item.id === mapping.constantId);
            const label = constant ? `${constant.name}: ${constant.value}` : "Constant";
            return (
                <ChipGroup categoryName="Constant">
                    <Chip onClick={onRemove} isReadOnly={false} closeBtnAriaLabel="Remove mapping">
                        {label}
                    </Chip>
                </ChipGroup>
            );
        }
        const sourceLabel = mapping.sourcePath ? getPathKey(mapping.sourcePath) : "Source field";
        return (
            <ChipGroup categoryName="Source">
                <Chip onClick={onRemove} isReadOnly={false} closeBtnAriaLabel="Remove mapping">
                    {sourceLabel}
                </Chip>
            </ChipGroup>
        );
    }, [constants]);

    const addConstant = useCallback((event: React.FormEvent) => {
        event.preventDefault();
        if (!newConstantName.trim()) {
            return;
        }
        const entry: ConstantEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: newConstantName.trim(),
            value: newConstantValue,
        };
        setConstants(prev => [...prev, entry]);
        setNewConstantName("");
        setNewConstantValue("");
        setShowConstantForm(false);
    }, [newConstantName, newConstantValue]);

    const removeConstant = useCallback((id: string) => {
        setConstants(prev => prev.filter(item => item.id !== id));
        const next = {...mappings};
        let changed = false;
        Object.keys(next).forEach(key => {
            const mapping = next[key];
            if (mapping.kind === "constant" && mapping.constantId === id) {
                delete next[key];
                changed = true;
            }
        });
        if (changed) {
            setMappings(next);
            props.onMappingsChange?.(Object.values(next));
            scheduleConnections();
        }
    }, [mappings, props, scheduleConnections]);

    const renderConstants = useCallback(() => {
        return (
            <div className="data-mapper__constants">
                {constants.map(constant => (
                    <div
                        key={constant.id}
                        className="data-mapper__constant"
                        draggable
                        onDragStart={(event) => handleDragStart(event, {
                            targetPath: [],
                            kind: "constant",
                            constantId: constant.id,
                        })}
                    >
                        <div
                            className="data-mapper__anchor source data-mapper__constant-anchor"
                            ref={(element) => registerConstant(constant.id, element)}
                            title="Drag to connect"
                        >
                            <span className="data-mapper__anchor-dot"/>
                        </div>
                        <div className="data-mapper__constant-info">
                            <CodeIcon className="data-mapper__constant-icon"/>
                            <div>
                                <div className="data-mapper__constant-name">{constant.name}</div>
                                <div className="data-mapper__constant-value">{constant.value}</div>
                            </div>
                        </div>
                        <Button
                            variant="plain"
                            aria-label="Remove constant"
                            icon={<TimesIcon/>}
                            onClick={() => removeConstant(constant.id)}
                        />
                    </div>
                ))}
                {showConstantForm ? (
                    <Card isCompact isFlat className="data-mapper__constant-form">
                        <CardBody>
                            <Form onSubmit={addConstant}>
                                <FormGroup label="Name" isRequired fieldId="constant-name">
                                    <TextInput
                                        id="constant-name"
                                        value={newConstantName}
                                        onChange={(_event, value) => setNewConstantName(value)}
                                    />
                                </FormGroup>
                                <FormGroup label="Value" fieldId="constant-value">
                                    <TextArea
                                        id="constant-value"
                                        value={newConstantValue}
                                        onChange={(_event, value) => setNewConstantValue(value)}
                                    />
                                </FormGroup>
                                <Flex justifyContent={{default: "justifyContentFlexEnd"}} spaceItems={{default: "spaceItemsSm"}}>
                                    <Button type="submit" variant="primary">Save</Button>
                                    <Button variant="link" onClick={() => setShowConstantForm(false)}>Cancel</Button>
                                </Flex>
                            </Form>
                        </CardBody>
                    </Card>
                ) : (
                    <Button
                        variant="link"
                        icon={<PlusCircleIcon/>}
                        onClick={() => setShowConstantForm(true)}
                    >
                        Add constant
                    </Button>
                )}
            </div>
        );
    }, [addConstant, constants, handleDragStart, newConstantName, newConstantValue, registerConstant, removeConstant, showConstantForm]);

    const renderNode = useCallback((node: SchemaNode, level: number, column: ColumnKey) => {
        const isSource = column === "source";
        const isExpandable = node.children.length > 0;
        const isExpanded = expandedNodes[column]?.has(node.id) ?? false;
        const shouldShowChildren = isExpandable ? isExpanded : true;
        const mapping = !isSource ? mappings[getPathKey(node.path)] : undefined;
        const isDroppable = !isSource && ensureTargetIsDroppable(node);
        const isActiveDrop = activeDropPath === node.id;

        const sourceAnchorClass = `data-mapper__anchor source ${mapping ? "is-mapped" : ""}`;
        const targetAnchorClass = `data-mapper__anchor target ${mapping ? "is-mapped" : ""}`;

        return (
            <div key={node.id} className={`data-mapper__tree-node level-${level}`}>
                <div
                    className={`
                        data-mapper__tree-row
                        ${isDroppable ? "droppable" : ""}
                        ${isActiveDrop ? "active-drop" : ""}
                        ${mapping ? "mapped" : ""}
                    `}
                    data-column={column}
                    data-node-id={node.id}
                    draggable={isSource && node.isLeaf}
                    onDragStart={(event) => {
                        if (isSource && node.isLeaf) {
                            handleDragStart(event, {
                                targetPath: [],
                                kind: "source",
                                sourcePath: node.path,
                            });
                        }
                    }}
                    onDragOver={(event) => {
                        if (!isSource) {
                            handleDragOver(event, node);
                        }
                    }}
                    onDragLeave={(event) => {
                        if (!isSource) {
                            handleDragLeave(event, node);
                        }
                    }}
                    onDrop={(event) => {
                        if (!isSource) {
                            handleDrop(event, node);
                        }
                    }}
                >
                    {isSource && node.isLeaf && (
                        <div
                            className={sourceAnchorClass}
                            ref={(element) => registerAnchor("source", node.id, element)}
                            title="Drag to connect"
                        >
                            <span className="data-mapper__anchor-dot"/>
                        </div>
                    )}
                    <div className="data-mapper__tree-toggle" style={{marginLeft: `${level * 16}px`}}>
                        {isExpandable && (
                            <Button
                                variant="plain"
                                aria-label={isExpanded ? "Collapse" : "Expand"}
                                onClick={() => toggleNode(column, node)}
                                className="data-mapper__toggle-button"
                                icon={isExpanded ? <AngleDownIcon/> : <AngleRightIcon/>}
                            />
                        )}
                    </div>
                    <div className="data-mapper__tree-label">
                        {node.isLeaf
                            ? <OutlinedFileIcon className="data-mapper__tree-icon"/>
                            : <InProgressIcon className="data-mapper__tree-icon"/>}
                        <span className="data-mapper__tree-name">{node.displayName}</span>
                        {node.valueType && (
                            <Badge isRead className="data-mapper__badge">{node.valueType}</Badge>
                        )}
                    </div>
                    {!isSource && node.isLeaf && (
                        <>
                            <div
                                className={targetAnchorClass}
                                ref={(element) => registerAnchor("target", node.id, element)}
                                onDragOver={(event) => handleDragOver(event, node)}
                                onDragLeave={(event) => handleDragLeave(event, node)}
                                onDrop={(event) => handleDrop(event, node)}
                                title={mapping ? "Mapped field" : "Drop source field"}
                            >
                                <span className="data-mapper__anchor-dot"/>
                            </div>
                            <div className="data-mapper__anchor-actions">
                                {mapping
                                    ? renderMappingChip(mapping, () => removeMapping(node.path))
                                    : <span className="data-mapper__drop-hint">Drop source</span>}
                            </div>
                        </>
                    )}
                </div>
                {isExpandable && shouldShowChildren && (
                    <div className="data-mapper__tree-children">
                        {node.children.map(child => renderNode(child, level + 1, column))}
                    </div>
                )}
            </div>
        );
    }, [activeDropPath, ensureTargetIsDroppable, expandedNodes, handleDragLeave, handleDragOver, handleDragStart, handleDrop, mappings, registerAnchor, renderMappingChip, removeMapping, toggleNode]);

    const renderColumnHeader = useCallback((column: ColumnKey, title: string, inputRef: React.RefObject<HTMLInputElement>, state: ColumnState) => {
        return (
            <CardHeader className="data-mapper__panel-header">
                <CardTitle>
                    <TextContent>
                        <Text component={TextVariants.h3}>{title}</Text>
                    </TextContent>
                </CardTitle>
                <div className="data-mapper__panel-actions">
                    <Button
                        variant="secondary"
                        icon={<UploadIcon/>}
                        onClick={() => inputRef.current?.click()}
                    >
                        Upload
                    </Button>
                    <Button
                        variant="link"
                        isInline
                        onClick={() => setJsonEditor({column, value: state.json})}
                    >
                        Edit JSON
                    </Button>
                </div>
            </CardHeader>
        );
    }, []);

    const renderColumnBody = useCallback((column: ColumnKey, nodes: SchemaNode[], state: ColumnState) => {
        if (state.error) {
            return (
                <CardBody className="data-mapper__panel-body">
                    <Alert variant="danger" title="Invalid JSON" isInline>
                        {state.error}
                    </Alert>
                </CardBody>
            );
        }
        if (!nodes || nodes.length === 0) {
            return (
                <CardBody className="data-mapper__panel-body">
                    <EmptyState headingLevel="h4" titleText="Upload a JSON document to begin">
                        <EmptyStateIcon icon={UploadIcon}/>
                        <EmptyStateBody>
                            {column === "source"
                                ? "Provide a source JSON schema to map from."
                                : "Provide a target JSON schema to define mapping destinations."}
                        </EmptyStateBody>
                    </EmptyState>
                </CardBody>
            );
        }
        return (
            <CardBody className="data-mapper__panel-body">
                {column === "source" && (
                    <div className="data-mapper__constants-wrapper">
                        <Flex justifyContent={{default: "justifyContentSpaceBetween"}} alignItems={{default: "alignItemsCenter"}}>
                            <Text component={TextVariants.h4}>Constants</Text>
                            <Tooltip content="Drag constants to the target to map static values">
                                <InfoCircleIcon/>
                            </Tooltip>
                        </Flex>
                        {renderConstants()}
                        <Divider component="div" className="data-mapper__divider"/>
                    </div>
                )}
                <div className="data-mapper__tree" onScroll={handleTreeScroll}>
                    {nodes.map(node => renderNode(node, 0, column))}
                </div>
            </CardBody>
        );
    }, [handleTreeScroll, renderConstants, renderNode]);

    const renderMappingSummary = useCallback(() => {
        const entries = Object.values(mappings);
        if (entries.length === 0) {
            return (
                <Alert isInline variant="info" title="Create mappings">
                    Drag source fields or constants onto target fields to design the JSLT transformation.
                </Alert>
            );
        }
        return (
            <div className="data-mapper__summary">
                <Text component={TextVariants.h4}>Current mappings</Text>
                <ul className="data-mapper__summary-list">
                    {entries.map(entry => (
                        <li key={getPathKey(entry.targetPath)} className="data-mapper__summary-item">
                            <span className="data-mapper__summary-target">{getPathKey(entry.targetPath)}</span>
                            <span className="data-mapper__summary-arrow">←</span>
                            {entry.kind === "source" && entry.sourcePath && (
                                <span className="data-mapper__summary-source">{getPathKey(entry.sourcePath)}</span>
                            )}
                            {entry.kind === "constant" && (
                                <span className="data-mapper__summary-source">
                                    {constants.find(c => c.id === entry.constantId)?.name || "Constant"}
                                </span>
                            )}
                            <Button
                                variant="link"
                                isInline
                                icon={<TimesIcon/>}
                                onClick={() => removeMapping(entry.targetPath)}
                            >
                                Remove
                            </Button>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }, [constants, mappings, removeMapping]);

    const renderJsonEditor = useCallback(() => {
        if (!jsonEditor) {
            return null;
        }
        const state = jsonEditor.column === "source" ? source : target;
        return (
            <Modal
                variant={ModalVariant.medium}
                title={`Edit ${jsonEditor.column === "source" ? "source" : "target"} JSON`}
                isOpen={true}
                onClose={() => setJsonEditor(undefined)}
                actions={[
                    <Button key="save" variant="primary" onClick={() => {
                        const success = applyJsonChange(jsonEditor.column, jsonEditor.value);
                        if (success) {
                            setJsonEditor(undefined);
                        }
                    }}>Save</Button>,
                    <Button key="cancel" variant="link" onClick={() => setJsonEditor(undefined)}>Cancel</Button>
                ]}
            >
                <TextArea
                    value={jsonEditor.value}
                    onChange={(_event, value) => setJsonEditor({column: jsonEditor.column, value})}
                    resizeOrientation="vertical"
                    rows={16}
                />
                {state.error && (
                    <Alert variant="danger" isInline title="Last parse failed" className="data-mapper__modal-alert">
                        {state.error}
                    </Alert>
                )}
            </Modal>
        );
    }, [applyJsonChange, jsonEditor, source, target]);

    return (
        <div className="data-mapper">
            <div className="data-mapper__canvas" ref={canvasRef}>
                <div className="data-mapper__columns">
                    <Card isFlat className="data-mapper__panel">
                        {renderColumnHeader("source", "Source", sourceInputRef, source)}
                        <input
                            ref={sourceInputRef}
                            type="file"
                            accept=".json,application/json"
                            style={{display: "none"}}
                            onChange={(event) => handleFileSelection(event, "source")}
                        />
                        {renderColumnBody("source", sourceNodes, source)}
                    </Card>
                    <Card isFlat className="data-mapper__panel">
                        {renderColumnHeader("target", "Target", targetInputRef, target)}
                        <input
                            ref={targetInputRef}
                            type="file"
                            accept=".json,application/json"
                            style={{display: "none"}}
                            onChange={(event) => handleFileSelection(event, "target")}
                        />
                        {renderColumnBody("target", targetNodes, target)}
                    </Card>
                </div>
                <svg className="data-mapper__connections">
                    <defs>
                        <marker id="data-mapper-arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                            <path d="M0,0 L6,3 L0,6 z" className="data-mapper__connection-arrow"/>
                        </marker>
                    </defs>
                    {connections.map(line => (
                        <path key={line.id} d={line.d} markerEnd="url(#data-mapper-arrow)" className="data-mapper__connection-path"/>
                    ))}
                </svg>
            </div>
            <div className="data-mapper__aside">
                {renderMappingSummary()}
                <Button
                    variant="primary"
                    onClick={() => setShowGenerator(true)}
                    isDisabled={Object.keys(mappings).length === 0}
                >
                    Generate JSLT
                </Button>
            </div>
            {renderJsonEditor()}
            <JSLTGenerator
                isOpen={showGenerator}
                onClose={() => setShowGenerator(false)}
                mappings={Object.values(mappings)}
                constants={constants}
            />
        </div>
    );
}
