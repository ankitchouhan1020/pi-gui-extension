<script lang="ts">
  import { cn } from "$lib/utils";
  import { badge, btn } from "./_btn.js";
  import FileText from "@lucide/svelte/icons/file-text";
  import Upload from "@lucide/svelte/icons/upload";
  import Download from "@lucide/svelte/icons/download";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ZoomIn from "@lucide/svelte/icons/zoom-in";
  import ZoomOut from "@lucide/svelte/icons/zoom-out";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import FileSpreadsheet from "@lucide/svelte/icons/file-spreadsheet";
  import FileIcon from "@lucide/svelte/icons/file";
  import Copy from "@lucide/svelte/icons/copy";
  import Highlighter from "@lucide/svelte/icons/highlighter";
  import TableIcon from "@lucide/svelte/icons/table";

  export interface ExtractedSection {
    id: string;
    type: "text" | "table" | "image" | "metadata";
    title: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    confidence?: number;
    page?: number;
  }

  export interface DocumentInfo {
    name: string;
    type: "pdf" | "csv" | "docx" | "xlsx" | "txt";
    size: number;
    pages?: number;
    uploadedAt?: string;
  }

  export interface AgentDocScannerProps {
    document?: DocumentInfo;
    extractedSections?: ExtractedSection[];
    currentPage?: number;
    totalPages?: number;
    isProcessing?: boolean;
    uploadProgress?: number;
    previewUrl?: string;
    onFileUpload?: (file: File) => void;
    onExtract?: (sectionId: string) => void;
    onExport?: (format?: "json" | "csv" | "txt") => void;
    onPageChange?: (page: number) => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onRotate?: () => void;
    onCopySection?: (sectionId: string) => void;
    onHighlightSection?: (sectionId: string) => void;
    showBottomActions?: boolean;
    class?: string;
    timestamp?: string;
  }

  let {
    document: docProp,
    extractedSections = [],
    currentPage = 1,
    totalPages = 1,
    isProcessing = false,
    uploadProgress = 0,
    previewUrl,
    onFileUpload,
    onExport,
    onPageChange,
    onZoomIn,
    onZoomOut,
    onRotate,
    onCopySection,
    onHighlightSection,
    showBottomActions = true,
    class: className,
    timestamp = "2:34 PM",
  }: AgentDocScannerProps = $props();

  let dragActive = $state(false);
  let activeTab = $state<"preview" | "extracted">("preview");
  let exportOpen = $state(false);
  let fileInputEl = $state<HTMLInputElement | null>(null);

  const defaultDocument: DocumentInfo = {
    name: "sample-invoice.pdf",
    type: "pdf",
    size: 245000,
    pages: 3,
    uploadedAt: "2024-01-20T14:30:00Z",
  };

  const defaultSections: ExtractedSection[] = [
    {
      id: "1",
      type: "metadata",
      title: "Document Information",
      content: {
        company: "Acme Corporation",
        invoiceNumber: "INV-2024-001",
        date: "January 20, 2024",
        dueDate: "February 20, 2024",
      },
      confidence: 0.98,
      page: 1,
    },
    {
      id: "2",
      type: "table",
      title: "Invoice Items",
      content: [
        { item: "Professional Services", quantity: 40, rate: 150, amount: 6000 },
        { item: "Software License", quantity: 5, rate: 299, amount: 1495 },
        { item: "Support Package", quantity: 1, rate: 500, amount: 500 },
      ],
      confidence: 0.95,
      page: 1,
    },
    {
      id: "3",
      type: "text",
      title: "Payment Terms",
      content:
        "Payment is due within 30 days. Late payments subject to 1.5% monthly interest. Please reference invoice number on all payments.",
      confidence: 0.92,
      page: 2,
    },
    {
      id: "4",
      type: "text",
      title: "Total Amount",
      content: "$7,995.00",
      confidence: 0.99,
      page: 1,
    },
  ];

  const displayDocument = $derived(docProp || defaultDocument);
  const displaySections = $derived(
    extractedSections.length > 0 ? extractedSections : defaultSections
  );

  function handleDrag(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      dragActive = true;
    } else if (e.type === "dragleave") {
      dragActive = false;
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragActive = false;
    if (e.dataTransfer?.files?.[0]) {
      onFileUpload?.(e.dataTransfer.files[0]);
    }
  }

  function handleFileInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (input.files?.[0]) {
      onFileUpload?.(input.files[0]);
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatKey(key: string) {
    return key.replace(/([A-Z])/g, " $1").trim();
  }
</script>

<div class={cn("space-y-4 p-4", className)}>
  <div class="flex items-center gap-3 text-sm text-muted-foreground">
    <div
      class="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full"
      data-slot="avatar"
    >
      <div
        class="bg-muted flex size-full items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
        data-slot="avatar-fallback"
      >
        <FileText class="h-4 w-4" />
      </div>
    </div>
    <span>Doc Scanner Agent</span>
    <span class="text-xs">{timestamp}</span>
  </div>

  <div class="space-y-4">
    {#if !previewUrl}
      <div
        class={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          dragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300"
        )}
        role="button"
        tabindex="0"
        ondragenter={handleDrag}
        ondragleave={handleDrag}
        ondragover={handleDrag}
        ondrop={handleDrop}
      >
        <Upload class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 class="font-medium mb-2">Drop your document here</h3>
        <p class="text-sm text-muted-foreground mb-4">
          Supports PDF, CSV, DOCX, XLSX, and TXT files up to 10MB
        </p>
        <button
          type="button"
          class={btn("outline")}
          onclick={() => fileInputEl?.click()}
        >
          Choose File
        </button>
        <input
          bind:this={fileInputEl}
          type="file"
          class="hidden"
          accept=".pdf,.csv,.docx,.xlsx,.txt"
          onchange={handleFileInput}
        />
      </div>
    {:else}
      <div class="w-full">
        <div
          class="inline-flex h-10 w-full items-center justify-start border-b border-zinc-200 bg-transparent text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
        >
          <button
            type="button"
            class={cn(
              "ring-offset-background focus-visible:ring-ring group relative inline-flex h-10 items-center justify-center rounded-none bg-transparent px-4 py-1 pt-2 pb-3 text-sm font-medium whitespace-nowrap text-zinc-500 transition-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-zinc-950 dark:text-zinc-500 dark:data-[state=active]:text-white",
              activeTab === "preview" && "text-zinc-950 dark:text-white"
            )}
            data-state={activeTab === "preview" ? "active" : "inactive"}
            onclick={() => (activeTab = "preview")}
          >
            Document Preview
            {#if activeTab === "preview"}
              <div class="absolute bottom-0 flex h-0.5 w-full justify-center">
                <div class="h-0.5 w-4/5 bg-zinc-950 dark:bg-white"></div>
              </div>
            {/if}
          </button>
          <button
            type="button"
            class={cn(
              "ring-offset-background focus-visible:ring-ring group relative inline-flex h-10 items-center justify-center rounded-none bg-transparent px-4 py-1 pt-2 pb-3 text-sm font-medium whitespace-nowrap text-zinc-500 transition-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-zinc-950 dark:text-zinc-500 dark:data-[state=active]:text-white",
              activeTab === "extracted" && "text-zinc-950 dark:text-white"
            )}
            data-state={activeTab === "extracted" ? "active" : "inactive"}
            onclick={() => (activeTab = "extracted")}
          >
            Extracted Data
            {#if activeTab === "extracted"}
              <div class="absolute bottom-0 flex h-0.5 w-full justify-center">
                <div class="h-0.5 w-4/5 bg-zinc-950 dark:bg-white"></div>
              </div>
            {/if}
          </button>
        </div>

        {#if activeTab === "preview"}
          <div class="space-y-4 mt-2">
            <div
              class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div class="flex items-center gap-3">
                {#if displayDocument.type === "pdf"}
                  <FileText class="h-4 w-4" />
                {:else if displayDocument.type === "csv" || displayDocument.type === "xlsx"}
                  <FileSpreadsheet class="h-4 w-4" />
                {:else}
                  <FileIcon class="h-4 w-4" />
                {/if}
                <div>
                  <p class="font-medium text-sm">{displayDocument.name}</p>
                  <p class="text-xs text-muted-foreground">
                    {formatFileSize(displayDocument.size)} • {displayDocument.pages} pages
                  </p>
                </div>
              </div>
              <div class={badge("secondary")}>{displayDocument.type.toUpperCase()}</div>
            </div>

            <div class="border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
              {#if isProcessing}
                <div class="flex flex-col items-center justify-center p-12 space-y-4">
                  <RefreshCw class="h-8 w-8 animate-spin text-blue-600" />
                  <p class="text-sm text-muted-foreground">Processing document...</p>
                  <div
                    class="relative h-2 w-48 overflow-hidden rounded-full bg-secondary"
                    data-slot="progress"
                  >
                    <div
                      class="h-full w-full flex-1 bg-primary transition-all"
                      style="transform: translateX(-{100 - uploadProgress}%)"
                    ></div>
                  </div>
                </div>
              {:else}
                <div class="relative">
                  <div
                    class="h-[400px] flex items-center justify-center bg-white dark:bg-gray-800"
                  >
                    <p class="text-muted-foreground">Document preview would appear here</p>
                  </div>

                  <div
                    class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3"
                  >
                    <button
                      type="button"
                      class={btn("ghost", "sm", "h-8 w-8")}
                      onclick={() => onPageChange?.(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft class="h-4 w-4" />
                    </button>
                    <span
                      class="text-sm px-4 py-1 bg-gray-50 dark:bg-gray-700 rounded min-w-[60px] text-center"
                    >
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      class={btn("ghost", "sm", "h-8 w-8")}
                      onclick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight class="h-4 w-4" />
                    </button>
                    <div class="w-px h-6 bg-gray-300 mx-2"></div>
                    <button
                      type="button"
                      class={btn("ghost", "sm", "h-8 w-8")}
                      onclick={() => onZoomOut?.()}
                    >
                      <ZoomOut class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class={btn("ghost", "sm", "h-8 w-8")}
                      onclick={() => onZoomIn?.()}
                    >
                      <ZoomIn class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class={btn("ghost", "sm", "h-8 w-8")}
                      onclick={() => onRotate?.()}
                    >
                      <RotateCw class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <div class="space-y-4 mt-2">
            <div class="space-y-3">
              {#each displaySections as section (section.id)}
                <div
                  class="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-2">
                        <div class={badge("outline")}>
                          {#if section.type === "table"}
                            <TableIcon class="h-3 w-3 mr-1" />
                          {/if}
                          {section.type}
                        </div>
                        <h4 class="font-medium text-sm">{section.title}</h4>
                        {#if section.page}
                          <span class="text-xs text-muted-foreground">Page {section.page}</span>
                        {/if}
                      </div>
                      {#if section.confidence}
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-xs text-muted-foreground">Confidence:</span>
                          <div
                            class="relative h-2 w-24 overflow-hidden rounded-full bg-secondary"
                          >
                            <div
                              class="h-full w-full flex-1 bg-primary transition-all"
                              style="transform: translateX(-{100 - section.confidence * 100}%)"
                            ></div>
                          </div>
                          <span class="text-xs">{Math.round(section.confidence * 100)}%</span>
                        </div>
                      {/if}
                    </div>
                    <div class="flex gap-1">
                      <button
                        type="button"
                        class={btn("ghost", "icon", "h-8 w-8")}
                        onclick={() => onCopySection?.(section.id)}
                        title="Copy section"
                      >
                        <Copy class="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        class={btn("ghost", "icon", "h-8 w-8")}
                        onclick={() => onHighlightSection?.(section.id)}
                        title="Highlight in document"
                      >
                        <Highlighter class="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div class="bg-gray-50 dark:bg-gray-800 rounded p-3">
                    {#if section.type === "metadata"}
                      <div class="space-y-2">
                        {#each Object.entries(section.content) as [key, value]}
                          <div class="flex justify-between">
                            <span class="text-sm text-muted-foreground capitalize">
                              {formatKey(key)}:
                            </span>
                            <span class="text-sm font-medium">{value as string}</span>
                          </div>
                        {/each}
                      </div>
                    {:else if section.type === "table"}
                      <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                          <thead class="border-b">
                            <tr>
                              {#each Object.keys(section.content[0] ?? {}) as key}
                                <th class="text-left p-2 capitalize">{key}</th>
                              {/each}
                            </tr>
                          </thead>
                          <tbody>
                            {#each section.content as row, i}
                              <tr class="border-b">
                                {#each Object.values(row) as value, j}
                                  <td class="p-2">
                                    {typeof value === "number" &&
                                    j === Object.keys(row).length - 1
                                      ? `$${(value as number).toLocaleString()}`
                                      : value}
                                  </td>
                                {/each}
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {:else if section.type === "text"}
                      <p class="text-sm text-foreground">{section.content}</p>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>

            <div class="flex justify-end relative">
              <button
                type="button"
                class={btn("outline")}
                onclick={() => (exportOpen = !exportOpen)}
              >
                <Download class="h-4 w-4 mr-2" />
                Export Data
              </button>
              {#if exportOpen}
                <div
                  class="absolute right-0 bottom-full mb-1 z-50 min-w-32 overflow-hidden rounded-md border bg-popover text-popover-foreground p-1 shadow-md"
                >
                  <button
                    type="button"
                    class="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onclick={() => {
                      onExport?.("json");
                      exportOpen = false;
                    }}
                  >
                    Export as JSON
                  </button>
                  <button
                    type="button"
                    class="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onclick={() => {
                      onExport?.("csv");
                      exportOpen = false;
                    }}
                  >
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    class="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onclick={() => {
                      onExport?.("txt");
                      exportOpen = false;
                    }}
                  >
                    Export as Text
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if showBottomActions}
    <div class="flex items-center justify-between pt-2">
      <div class="flex gap-2">
        {#if displayDocument}
          <div class={badge("secondary")}>
            {displaySections.length} sections extracted
          </div>
        {/if}
      </div>
      <div class="flex gap-1">
        <button type="button" class={btn("ghost", "icon", "h-8 w-8")}>😊</button>
        <button type="button" class={btn("ghost", "icon", "h-8 w-8")}>😔</button>
      </div>
    </div>
  {/if}
</div>
