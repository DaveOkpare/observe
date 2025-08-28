# Traces Integration Plan for Interface Template

## Project Context
This is a self-hosted observability platform that captures OpenTelemetry traces from instrumented applications. We have two directories:
- `/ui/` - Existing sophisticated trace visualization with rich span renderers
- `/interface/` - New professional template with quotes/CRM functionality that we want to adapt

**Goal**: Surgically integrate our trace functionality into the interface template, preserving its design while replacing content with observability features.

## Source Files Overview

### Current UI Directory Structure (`/ui/`)
```
ui/
├── components/
│   ├── CopyButton.tsx          # Copy-to-clipboard with feedback
│   ├── JsonCode.tsx            # Custom JSON syntax highlighter
│   ├── StatCard.tsx            # Simple metric display cards
│   ├── ThemeToggle.tsx         # Dark/light mode toggle
│   ├── spans/                  # Rich span visualization components
│   │   ├── SpanRenderer.tsx        # Main orchestrator (routes to specific renderers)
│   │   ├── AdaptiveSpanView.tsx    # Fallback for unknown span types
│   │   ├── AIAgentView.tsx         # AI agent interactions with chat bubbles
│   │   ├── LLMChatView.tsx         # LLM chat interfaces
│   │   ├── HTTPRequestView.tsx     # HTTP request/response visualization
│   │   ├── DatabaseSpanView.tsx    # SQL operations display
│   │   ├── ExternalAPIView.tsx     # External API calls
│   │   ├── FunctionModelView.tsx   # Function/model execution
│   │   ├── LogMessageView.tsx      # Log entries with metadata
│   │   └── TokenUsageBadge.tsx     # AI model token usage and costs
│   └── ui/                     # Base components (button, select)
├── lib/
│   ├── api.ts                  # API communication (fetchTraces, fetchLogs)
│   ├── attributeParsers.ts     # OpenTelemetry attribute parsing utilities
│   ├── config.ts               # Environment configuration
│   ├── datetime.ts             # Date/time formatting for various timestamp formats
│   ├── flags.ts                # Feature flags (RICH_SPANS)
│   ├── spanDetection.ts        # Intelligent span type detection
│   └── utils.ts                # Tailwind class merging utility
└── app/
    ├── page.tsx                # Main traces listing with tabs, filters, pagination
    └── traces/[traceId]/page.tsx # Individual trace detail view
```

### Target Interface Directory Structure (`/interface/`)
```
interface/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── homepage/MetricsCards.tsx    # Dashboard metric cards
│   │   │   └── navigation/AppSidebar.tsx    # Sidebar (TO BE REMOVED)
│   │   ├── Button.tsx, Input.tsx, etc.     # UI components
│   │   └── [other components]
│   ├── lib/
│   │   └── [utility functions]
│   └── app/
│       └── quotes/
│           ├── layout.tsx              # Main layout with MetricsCards and navigation
│           ├── overview/page.tsx       # Table view (quotes → traces)
│           └── audits/page.tsx         # Detail view (→ rich span content)
```

## Detailed Implementation Plan

### Phase 1: Foundation Setup

#### Task 1.1: Remove Sidebar Components
**What to do:**
- Remove `AppSidebar.tsx` from `interface/src/components/ui/navigation/`
- Update `interface/src/app/layout.tsx` to remove any sidebar references
- Remove sidebar-related imports and JSX elements
- Ensure layout remains responsive without sidebar

**Files to modify:**
- `interface/src/app/layout.tsx`
- `interface/src/components/ui/navigation/` (remove AppSidebar.tsx)

#### Task 1.2: Port Utility Functions
**What to do:** Copy these files exactly from `ui/lib/` to `interface/src/lib/`:

1. **api.ts**: API communication layer
   ```typescript
   // Contains: apiUrl(), fetchTraces(), fetchLogs(), interfaces for pagination
   // Purpose: Handles API calls to backend ingestor service
   ```

2. **config.ts**: Environment configuration
   ```typescript
   // Contains: API_BASE_URL constant
   // Purpose: Centralized config management
   ```

3. **datetime.ts**: Date/time formatting utilities
   ```typescript
   // Contains: toDate(), formatDate() functions
   // Purpose: Handles various OpenTelemetry timestamp formats (ns, μs, ms, s)
   ```

4. **flags.ts**: Feature flags
   ```typescript
   // Contains: RICH_SPANS boolean flag
   // Purpose: Controls whether to show rich span rendering
   ```

5. **attributeParsers.ts**: OpenTelemetry parsing utilities
   ```typescript
   // Contains: safeJsonParse(), parseAIConversation(), parseHTTPDetails(), parseTokenUsage()
   // Purpose: Extracts structured data from OpenTelemetry span attributes
   ```

6. **spanDetection.ts**: Span type detection
   ```typescript
   // Contains: detectSpanType(), extractMeaningfulFields(), SpanType union
   // Purpose: Intelligently determines span types (ai-agent, llm-chat, http-request, etc.)
   ```

**Target location:** `interface/src/lib/`

### Phase 2: Core Components

#### Task 2.1: Port Essential Components
**What to do:** Copy these components from `ui/components/` to `interface/src/components/`:

1. **JsonCode.tsx**: Custom JSON syntax highlighter
   - No external dependencies (custom tokenizer)
   - Color-coded syntax highlighting
   - Handles both string and object inputs

2. **CopyButton.tsx**: Copy-to-clipboard functionality
   - Takes `getText` function prop
   - Shows "Copied!" feedback for 1 second
   - Uses native clipboard API

3. **StatCard.tsx**: Metric display cards
   - Simple label/value/hint display
   - Will be used to enhance MetricsCards

**Target location:** `interface/src/components/`

#### Task 2.2: Update Utils
**What to do:**
- Copy `ui/lib/utils.ts` to `interface/src/lib/utils.ts`
- This contains the `cn()` function for Tailwind class merging
- Required by many components for conditional styling

### Phase 3: Rich Span Rendering System

#### Task 3.1: Create Spans Directory and Port SpanRenderer
**What to do:**
1. Create `interface/src/components/spans/` directory
2. Copy `SpanRenderer.tsx` from `ui/components/spans/`
   - This is the main orchestrator component
   - Routes spans to appropriate specialized renderers based on `detectSpanType()`
   - Handles data extraction and parsing for each span type

#### Task 3.2: Port All Specialized Span Views
**What to do:** Copy all span view components from `ui/components/spans/` to `interface/src/components/spans/`:

1. **AdaptiveSpanView.tsx**: Generic fallback renderer
   - Grid layout for meaningful fields
   - Collapsible raw attributes with JsonCode
   - Copy functionality for raw data

2. **AIAgentView.tsx**: AI agent interaction renderer
   - Conversation history display
   - Collapsible system prompts  
   - Tool calls and responses
   - Token usage display with TokenUsageBadge

3. **LLMChatView.tsx**: Chat interface renderer
   - Chat bubble UI with role-based styling
   - System prompt handling (collapsible)
   - Tool call/response parsing
   - Message extraction from various event formats

4. **HTTPRequestView.tsx**: HTTP request/response renderer
   - Method-based color coding (GET=blue, POST=green, etc.)
   - Status code styling with descriptive text
   - Parameter table display
   - Duration and URL display

5. **DatabaseSpanView.tsx**: Database operation renderer
   - SQL statement display (collapsible)
   - Operation name and database system info
   - Duration display with copy functionality

6. **ExternalAPIView.tsx**: External API call renderer
   - Server address and operation display
   - HTTP status, method, URL information
   - Clickable URLs (open in new tabs with proper rel attributes)

7. **FunctionModelView.tsx**: Function/model execution renderer
   - Model name display
   - Parameter display (collapsible JSON)
   - Error handling and success indicators

8. **LogMessageView.tsx**: Log message renderer
   - Log level display with color coding (ERROR=red, WARNING=yellow, etc.)
   - File path and line number display
   - Function name display
   - Numeric log level to text conversion

9. **TokenUsageBadge.tsx**: Token usage and cost estimation
   - Input/output/total token display
   - Cost estimation for popular models (GPT-4o, GPT-3.5, etc.)
   - Tooltip with detailed breakdown

**Important:** Ensure all imports are updated to reflect the new directory structure.

### Phase 4: Page Integration

#### Task 4.1: Overview Page Data Adaptation
**Current:** `interface/src/app/quotes/overview/page.tsx` displays quotes data
**Goal:** Adapt to display traces data while keeping the same UI structure

**What to do:**
1. Replace quotes data import with traces API calls
2. Update table headers:
   - "Company" → "Service" 
   - "Deal Size" → "Duration"
   - "Win Probability" → "Span Count"
   - "Project Duration" → "Status"
   - "Assigned" → "Operation"
   - "Status" → "Time"

3. Update table data mapping:
   ```typescript
   // Replace quote.project.map() with traces.map()
   // Map trace fields to table columns:
   // - trace.service_name → Service
   // - formatDuration(trace.duration_ms) → Duration  
   // - trace.span_count → Span Count
   // - trace.status → Status
   // - trace.operation_name → Operation
   // - formatTime(trace.start_time) → Time
   ```

4. Add trace-specific filtering:
   - Service filter (replace "Assigned to" dropdown)
   - Operation filter (additional input)
   - Time range filter (optional)

5. Make table rows clickable to navigate to trace details
6. Use appropriate icons from template's icon library for trace status and operations

**Key considerations:**
- Keep existing search functionality (adapt for trace data)
- Maintain pagination and export button (adapt export for traces)
- Preserve responsive design and styling
- Use template's Badge component for status indicators

#### Task 4.2: Audits Page Rich Content Integration
**Current:** `interface/src/app/quotes/audits/page.tsx` has basic audit functionality
**Goal:** Replace content with rich span analysis using our renderers

**What to do:**
1. Keep the existing page layout and header structure
2. Replace main content area with trace span analysis:
   - List of spans for selected trace
   - Each span row has an expandable section
   - Expanded section shows rich span renderer content
   - Progressive disclosure: span summary → detailed renderer

3. Integration pattern:
   ```typescript
   // Pseudocode structure:
   <div className="space-y-4">
     {spans.map(span => (
       <div key={span.span_id} className="border rounded-lg">
         <div className="p-4 cursor-pointer" onClick={() => toggleExpand()}>
           {/* Span summary: operation, service, duration, status */}
         </div>
         {isExpanded && (
           <div className="border-t p-4">
             <SpanRenderer span={span} />
           </div>
         )}
       </div>
     ))}
   </div>
   ```

4. Use template's existing components:
   - Accordion/Collapsible for span expansion
   - Badge components for status indicators
   - Button components for actions
   - Icon components for span types

5. Add filtering/search for spans within a trace
6. Maintain template's visual design language throughout

### Phase 5: Metrics and Enhancement

#### Task 5.1: MetricsCards Integration
**Current:** `interface/src/components/ui/homepage/MetricsCards.tsx` shows generic metrics
**Goal:** Show trace-related observability metrics

**What to do:**
1. Update MetricsCards to accept optional trace data props
2. Calculate and display:
   - Total traces (last 24h/7d)
   - Average response time
   - Error rate percentage  
   - Active services count

3. Add optional loading states
4. Maintain existing card design and responsive layout
5. Use StatCard component if it provides better functionality

**Implementation approach:**
```typescript
interface MetricsData {
  totalTraces?: number;
  avgDuration?: string;
  errorRate?: string;
  activeServices?: number;
}

// Update component to accept optional metrics data
// Fallback to placeholder/default values if not provided
```

#### Task 5.2: Add Trace Detail Modal/Drawer
**Goal:** Provide detailed trace view that can be triggered from any page

**What to do:**
1. Create `TraceDetailModal.tsx` or `TraceDetailDrawer.tsx`
2. Include trace timeline visualization (port from `ui/app/traces/[traceId]/page.tsx`)
3. Show trace summary statistics
4. List all spans with rich renderers
5. Add navigation between spans within trace
6. Implement with template's modal/drawer components

**Integration points:**
- Clickable trace IDs in overview table
- Expandable trace details in audits page
- Deep-link URLs for sharing trace details

### Phase 6: Polish and Testing

#### Task 6.1: Icon Integration and Visual Polish
**What to do:**
1. Audit all span renderers and replace generic icons with template icons
2. Map span types to appropriate icons:
   - HTTP requests: Globe or Network icon
   - Database: Database icon
   - AI/LLM: Brain or Zap icon
   - Functions: Code or Cpu icon
   - Logs: FileText icon
   - External APIs: ExternalLink icon

3. Ensure consistent icon usage across all components
4. Update status indicators to use template's color system
5. Verify responsive design works on all screen sizes

#### Task 6.2: Navigation and Context Updates
**What to do:**
1. Update `interface/src/app/quotes/layout.tsx` navigation labels:
   - Keep "Overview" (shows traces list)
   - "Audits" → "Trace Analysis" or keep "Audits"
   - Remove "Monitoring" tab or repurpose for metrics

2. Update breadcrumbs if present to reflect trace context
3. Update page titles and meta information
4. Ensure all navigation makes sense for observability use case

#### Task 6.3: Testing Checklist
**What to test:**
1. **Span Rendering**: All 8+ span types render correctly in dropdown/expanded contexts
2. **Progressive Disclosure**: Show/hide functionality works smoothly
3. **Copy Functionality**: All copy buttons work and provide feedback
4. **Responsive Design**: Interface works on mobile, tablet, desktop
5. **Data Integration**: API calls work and data displays correctly
6. **Performance**: Page loads and interactions are smooth
7. **Accessibility**: Keyboard navigation and screen readers work
8. **Error Handling**: Graceful fallbacks for missing/malformed data

## Technical Requirements

### Dependencies
Ensure these packages are available in `interface/` (check package.json):
- React 19.x
- Next.js 15.x
- Tailwind CSS v4
- Lucide React (for icons)
- TypeScript 5.x

### API Endpoints Expected
The interface expects these endpoints from the ingestor service:
- `GET /api/traces` - List traces with pagination and filtering
- `GET /api/traces/{traceId}` - Get specific trace with spans
- `GET /api/logs` - List logs with pagination and filtering

### Environment Variables
Required environment variables:
- `NEXT_PUBLIC_API_BASE_URL` - Backend ingestor service URL (default: http://localhost:8000)
- `NEXT_PUBLIC_RICH_SPANS` - Enable rich span rendering (default: true)

### Data Types
Key TypeScript interfaces to maintain:

```typescript
interface Trace {
  trace_id: string;
  service_name: string;
  operation_name: string;
  start_time: string | number;
  duration_ms: number;
  span_count: number;
  status: string;
}

interface Span {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  operation_name: string;
  service_name: string;
  start_time: string | number;
  end_time: string | number;
  duration_ms: number;
  status: string;
  attributes: Record<string, any>;
}
```

## Success Criteria

1. **Design Integrity**: Template's visual design is preserved throughout
2. **Functional Integration**: All trace functionality works seamlessly
3. **Rich Rendering**: Complex span data displays beautifully in constrained spaces
4. **Performance**: Fast loading and smooth interactions
5. **Usability**: Progressive disclosure provides excellent UX for complex data
6. **Consistency**: Icons, colors, and patterns match template's design system

## Final Notes

- **Preserve Before Enhancing**: Always keep existing template functionality intact
- **Progressive Enhancement**: Add observability features without breaking base template
- **Icon Consistency**: Use template's icon library throughout for cohesive design
- **Responsive First**: Ensure all components work across device sizes
- **Error Boundaries**: Add graceful fallbacks for missing or malformed trace data

## Key Technical Considerations

### Design Consistency
- Use template's icon library throughout span renderers
- Maintain template's color schemes and spacing
- Follow template's typography patterns
- Preserve template's responsive design patterns

### Rich Content Integration
- **Dropdown Integration**: Span renderers work well in constrained dropdown spaces
- **Progressive Disclosure**: Show span summary, expand for full details
- **Icon Usage**: Use appropriate icons for span types (database, HTTP, AI, etc.)
- **Status Indicators**: Color-coded status with template's badge patterns

### Data Flow
- **Overview Page**: List traces with basic metadata
- **Audits Page**: Detailed span analysis in expandable UI
- **Rich Renderers**: Full span details with copy, JSON views, timeline

### Component Architecture
```
interface/
├── components/
│   ├── spans/              # Rich span rendering system
│   │   ├── SpanRenderer.tsx
│   │   ├── AIAgentView.tsx
│   │   ├── LLMChatView.tsx
│   │   └── ... (all span views)
│   ├── JsonCode.tsx        # Custom JSON highlighter  
│   ├── CopyButton.tsx      # Copy functionality
│   └── StatCard.tsx        # Metrics display
├── lib/
│   ├── api.ts              # API layer
│   ├── attributeParsers.ts # OpenTel parsing
│   ├── spanDetection.ts    # Type detection
│   └── ... (utilities)
└── app/quotes/
    ├── overview/           # Traces listing (adapted)
    └── audits/             # Rich span analysis
```

## Benefits
- **Professional Design**: Maintains template's clean, modern aesthetic
- **Powerful Functionality**: Adds sophisticated trace visualization 
- **Focused Interface**: Streamlined without unnecessary sidebar
- **Progressive Enhancement**: Rich details available on-demand
- **Icon Consistency**: Leverages template's beautiful icon system
- **Responsive Design**: Works across all device sizes

## Success Metrics
- Rich span renderers work seamlessly in dropdown contexts
- All 8+ span types render with appropriate icons and styling
- Progressive disclosure provides good UX for complex trace data
- Template design integrity maintained throughout integration
- Copy functionality and interactions work reliably