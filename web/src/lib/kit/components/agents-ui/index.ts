// Shared barrel for agents-ui — all packages re-export from here.

// kit-agents-media
export { default as AgentImageEditor } from "./agent-image-editor.svelte";
export { default as AgentVideoEditor } from "./agent-video-editor.svelte";
export { default as AgentAudioGenerator } from "./agent-audio-generator.svelte";
export { default as AgentGrammarChecker } from "./agent-grammar-checker.svelte";
export { default as AgentArtifact } from "./agent-artifact.svelte";
export { default as AgentFormGenerator } from "./agent-form-generator.svelte";
export { default as AgentCodeExecutor } from "./agent-code-executor.svelte";
export { default as AgentDocScanner } from "./agent-doc-scanner.svelte";
export { default as AgentWebSearch } from "./agent-web-search.svelte";

export type {
  ImageVariation,
  AgentImageEditorProps,
} from "./agent-image-editor.svelte";
export type {
  VideoClip,
  AgentVideoEditorProps,
} from "./agent-video-editor.svelte";
export type {
  VoiceOption,
  AgentAudioGeneratorProps,
} from "./agent-audio-generator.svelte";
export type {
  GrammarIssueType,
  GrammarIssue,
  GrammarStats,
  AgentGrammarCheckerProps,
} from "./agent-grammar-checker.svelte";
export type {
  ArtifactType,
  ArtifactVersion,
  ArtifactMetadata,
  AgentArtifactProps,
} from "./agent-artifact.svelte";
export type {
  FormFieldType,
  FormFieldValidation,
  FormField,
  AgentFormGeneratorProps,
} from "./agent-form-generator.svelte";
export type {
  CodeExecutionOutput,
  CodeExecutionHistoryItem,
  AgentCodeExecutorProps,
} from "./agent-code-executor.svelte";
export type {
  ExtractedSection,
  DocumentInfo,
  AgentDocScannerProps,
} from "./agent-doc-scanner.svelte";
export type {
  SearchResult,
  AgentWebSearchProps,
} from "./agent-web-search.svelte";

// kit-agents-core
export { default as AgentCard } from "./agent-card.svelte";
export { default as AgentResponse } from "./agent-response.svelte";
export { default as AgentStatusPanel } from "./agent-status-panel.svelte";
export { default as AgentPromptComposer } from "./agent-prompt-composer.svelte";
export { default as AgentChatHistory } from "./agent-chat-history.svelte";
export { default as AgentToolPalette } from "./agent-tool-palette.svelte";
export { default as AgentToolkit } from "./agent-tool-palette.svelte";
export { default as AgentFeedback } from "./agent-feedback.svelte";

export type {
  AgentStatus,
  AgentCapability,
  AgentCardProps,
} from "./agent-card.svelte";
export type {
  ToolCall,
  Artifact,
  AgentResponseProps,
} from "./agent-response.svelte";
export type {
  ConnectionStatus,
  ModelCapability,
  ModelInfo,
  SystemResources,
  AgentStatusPanelProps,
} from "./agent-status-panel.svelte";
export type {
  PromptTemplate,
  Persona,
  AgentPromptComposerProps,
} from "./agent-prompt-composer.svelte";
export type {
  ChatMessage,
  ChatSession,
  AgentChatHistoryProps,
} from "./agent-chat-history.svelte";
export type {
  ToolCategory,
  AgentTool,
  AgentToolPaletteProps,
} from "./agent-tool-palette.svelte";
export type {
  FeedbackType,
  FeedbackCategory,
  FeedbackData,
  AgentFeedbackProps,
} from "./agent-feedback.svelte";

// kit-agents-hitl
export { default as AgentToolApproval } from "./agent-tool-approval.svelte";
export { default as AgentPlanBuilder } from "./agent-plan-builder.svelte";
export { default as AgentInquiry } from "./agent-inquiry.svelte";

export type {
  RiskLevel,
  ToolApprovalRequest,
  ToolApprovalHistoryItem,
  ToolExecutionResult,
  AgentToolApprovalProps,
} from "./agent-tool-approval.svelte";
export type {
  PlanStepStatus,
  PlanStep,
  AgentPlanBuilderProps,
} from "./agent-plan-builder.svelte";
export type {
  InquiryType,
  Inquiry,
  InquiryHistoryItem,
  AgentInquiryProps,
} from "./agent-inquiry.svelte";

// kit-agents-ops
export { default as AgentOpsMonitor } from "./agent-ops-monitor.svelte";
export { default as AgentTaskQueue } from "./agent-task-queue.svelte";
export { default as AgentWorkflowPlanner } from "./agent-workflow-planner.svelte";
export { default as AgentOrchestrator } from "./agent-orchestrator.svelte";
export { default as AgentParallelProcessor } from "./agent-parallel-processor.svelte";
export { default as AgentSequentialWorkflow } from "./agent-sequential-workflow.svelte";
export { default as AgentRoutingHub } from "./agent-routing-hub.svelte";
export { default as AgentEvaluator } from "./agent-evaluator.svelte";

export type {
  OpsSignal,
  OpsServiceMetric,
  IncidentEvent,
  AgentOpsMonitorProps,
} from "./agent-ops-monitor.svelte";
export type {
  AgentTaskStatus,
  AgentTaskPriority,
  AgentTaskTimelineStatus,
  AgentTaskTimelineEvent,
  AgentTaskAssignee,
  AgentTask,
  AgentTaskQueueProps,
} from "./agent-task-queue.svelte";
export type {
  WorkflowCheckpoint,
  WorkflowPlaybook,
  ActionItem,
  AgentWorkflowPlannerProps,
} from "./agent-workflow-planner.svelte";
export type {
  SubAgentStatus,
  SubAgentMetrics,
  SubAgent,
  CommLogEntry,
  AgentOrchestratorProps,
} from "./agent-orchestrator.svelte";
export type {
  ParallelLaneStatus,
  ParallelLane,
  AgentParallelProcessorProps,
} from "./agent-parallel-processor.svelte";
export type {
  WorkflowStepStatus,
  WorkflowStep,
  AgentSequentialWorkflowProps,
} from "./agent-sequential-workflow.svelte";
export type {
  RouteStatus,
  RouteClassification,
  AgentRoute,
  RoutingHistoryEntry,
  AgentRoutingHubProps,
} from "./agent-routing-hub.svelte";
export type {
  EvalCriterion,
  EvalIteration,
  AgentEvaluatorProps,
} from "./agent-evaluator.svelte";

// kit-agents-analytics
export { default as AgentAnalyticsPulse } from "./agent-analytics-pulse.svelte";
export { default as AgentRevenueInsights } from "./agent-revenue-insights.svelte";
export { default as AgentDataAnalysis } from "./agent-data-analysis.svelte";
export { default as AgentCompetitorResearch } from "./agent-competitor-research.svelte";
export { default as AgentSourcesCitations } from "./agent-sources-citations.svelte";

export type {
  PulseMetric,
  AttributionSlice,
  InsightHighlight,
  AgentAnalyticsPulseProps,
} from "./agent-analytics-pulse.svelte";
export type {
  RevenueForecastPoint,
  RevenueSegmentInsight,
  RevenueScenario,
  AgentRevenueInsightsProps,
} from "./agent-revenue-insights.svelte";
export type {
  DataMetric,
  DataPreview,
  DataInsight,
  DistributionBar,
  AgentDataAnalysisProps,
} from "./agent-data-analysis.svelte";
export type {
  ResearchDepth,
  ThreatLevel,
  Competitor,
  ComparisonFeature,
  AgentCompetitorResearchProps,
} from "./agent-competitor-research.svelte";
export type {
  SourceType,
  CitationSource,
  AgentSourcesCitationsProps,
} from "./agent-sources-citations.svelte";
