import type { VirtualFileSystem } from "@/lib/file-system";
import { AgentRole, type AgentStreamEvent } from "@/lib/agents/types";
import { saveProjectState } from "@/lib/agents/save-project";

function detectComponent(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("form")) return { type: "form", name: "ContactForm" };
  if (lower.includes("card")) return { type: "card", name: "Card" };
  return { type: "counter", name: "Counter" };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendDelayed(
  sendEvent: (e: AgentStreamEvent) => Promise<void>,
  event: AgentStreamEvent,
  delayMs: number = 300
) {
  await delay(delayMs);
  await sendEvent(event);
}

function getDesignSpec(component: { type: string; name: string }) {
  const specs: Record<string, string> = {
    form: `## Design Specification: ContactForm

**Component:** ContactForm
**File:** /components/ContactForm.jsx

### Layout
- Centered card container with white background, rounded corners, and shadow
- Vertical form layout with labeled fields

### Fields
1. **Name** — text input, required
2. **Email** — email input, required
3. **Message** — textarea (4 rows), required

### Interaction
- Submit button triggers validation + success alert
- All fields use controlled state via useState

### Styling
- Blue primary color (#3B82F6) for button and focus rings
- Gray borders on inputs, subtle hover/focus transitions
- Responsive max-width container`,

    card: `## Design Specification: Card

**Component:** Card
**File:** /components/Card.jsx

### Layout
- Rounded card with shadow, overflow hidden
- Optional hero image at top (full-width, 192px height)
- Content area with padding

### Props
- \`title\` (string) — card heading, defaults to "Welcome to Our Service"
- \`description\` (string) — body text
- \`imageUrl\` (string, optional) — hero image source
- \`actions\` (ReactNode, optional) — footer action buttons

### Styling
- White background, rounded-lg, shadow-md
- Hover transition on content area (subtle bg change)
- Semibold title, gray-600 description text`,

    counter: `## Design Specification: Counter

**Component:** Counter
**File:** /components/Counter.jsx

### Layout
- Centered column layout with white card background
- Large count display, control buttons below

### State
- \`count\` (number) — starts at 0

### Actions
- **Decrease** — red button, decrements count
- **Reset** — gray button, sets count to 0
- **Increase** — green button, increments count

### Styling
- Bold 4xl count number as focal point
- Color-coded buttons (red/gray/green) with hover states
- Consistent spacing and transitions`,
  };
  return specs[component.type] || specs.counter;
}

function getComponentCode(componentType: string): string {
  switch (componentType) {
    case "form":
      return `import React, { useState } from 'react';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-1 text-gray-900">Contact Us</h2>
      <p className="text-sm text-gray-500 mb-6">We'd love to hear from you. Fill out the form below.</p>

      {submitted && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          Thank you! We'll get back to you soon.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Your name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="you@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={4}
            placeholder="How can we help?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          Send Message
        </button>
      </form>
    </div>
  );
};

export default ContactForm;`;

    case "card":
      return `import React from 'react';

const Card = ({
  title = "Welcome to Our Service",
  description = "Discover amazing features and capabilities that will transform your experience.",
  imageUrl,
  actions
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform hover:scale-[1.02]">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-2 text-gray-900">{title}</h3>
        <p className="text-gray-500 leading-relaxed mb-4">{description}</p>
        {actions && (
          <div className="pt-2 border-t border-gray-100 mt-4">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;`;

    default:
      return `import { useState } from 'react';

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center p-8 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-2 text-gray-900">Counter</h2>
      <p className="text-sm text-gray-500 mb-6">Click the buttons to change the value</p>
      <div className="text-5xl font-bold mb-8 tabular-nums text-gray-900">{count}</div>
      <div className="flex gap-3">
        <button
          onClick={() => setCount(prev => prev - 1)}
          className="px-5 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 active:bg-red-700 transition-colors"
        >
          Decrease
        </button>
        <button
          onClick={() => setCount(0)}
          className="px-5 py-2.5 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 active:bg-gray-700 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => setCount(prev => prev + 1)}
          className="px-5 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 active:bg-green-700 transition-colors"
        >
          Increase
        </button>
      </div>
    </div>
  );
};

export default Counter;`;
  }
}

function getAppCode(componentName: string): string {
  if (componentName === "Card") {
    return `import Card from '@/components/Card';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Card
          title="Amazing Product"
          description="This is a fantastic product that will change your life. Experience the difference today!"
          actions={
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Learn More
            </button>
          }
        />
      </div>
    </div>
  );
}`;
  }

  return `import ${componentName} from '@/components/${componentName}';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <${componentName} />
      </div>
    </div>
  );
}`;
}

function getQAReview(component: { type: string; name: string }) {
  return `## QA Review: ${component.name}

**Verdict: APPROVED**

### Checks Passed
- Component renders without errors
- All interactive elements are functional
- Proper use of controlled state
- Accessible labels and semantic HTML
- Responsive layout with max-width container
- Tailwind classes are valid and consistent
- No unused imports or dead code
- Hover/focus states provide visual feedback

### Notes
- Clean component structure, single responsibility
- Good use of Tailwind utility classes for styling
- Proper event handling patterns`;
}

export async function runMockMultiAgentFlow(
  userContent: string,
  fileSystem: VirtualFileSystem,
  sendEvent: (e: AgentStreamEvent) => Promise<void>,
  writer: WritableStreamDefaultWriter,
  messages: any[],
  projectId?: string
) {
  (async () => {
    try {
      const component = detectComponent(userContent);
      const designSpec = getDesignSpec(component);

      // --- Orchestrator: kick off ---
      await sendEvent({
        type: "agent_start",
        agent: AgentRole.ORCHESTRATOR,
        content:
          "Starting multi-agent workflow — this is a mock demo (no API key). Add an ANTHROPIC_API_KEY to .env for real generation.",
      });
      await delay(400);

      // --- Design Agent ---
      await sendEvent({
        type: "agent_start",
        agent: AgentRole.DESIGN,
        content: `Analyzing request: "${userContent}"`,
      });
      await delay(600);

      await sendEvent({
        type: "agent_message",
        agent: AgentRole.DESIGN,
        content: designSpec,
      });
      await delay(400);

      await sendEvent({
        type: "agent_tool_call",
        agent: AgentRole.DESIGN,
        content: "Created design specification",
        toolName: "create_design_spec",
        toolArgs: { component: component.name },
      });
      await delay(300);

      await sendEvent({
        type: "agent_done",
        agent: AgentRole.DESIGN,
        content: `Design spec for ${component.name} ready — handing off to Engineer`,
      });
      await delay(500);

      // --- Engineer Agent ---
      await sendEvent({
        type: "agent_start",
        agent: AgentRole.ENGINEER,
        content: `Building ${component.name} from design spec`,
      });
      await delay(500);

      await sendEvent({
        type: "agent_message",
        agent: AgentRole.ENGINEER,
        content: `I'll implement the ${component.name} component based on the design specification. Creating the component file and the App entry point.`,
      });
      await delay(400);

      // Create or update the component file in VFS
      const componentCode = getComponentCode(component.type);
      const componentPath = `/components/${component.name}.jsx`;
      if (fileSystem.exists(componentPath)) {
        fileSystem.updateFile(componentPath, componentCode);
      } else {
        fileSystem.createFileWithParents(componentPath, componentCode);
      }

      await sendEvent({
        type: "agent_tool_call",
        agent: AgentRole.ENGINEER,
        content: `Created /components/${component.name}.jsx`,
        toolName: "str_replace_editor",
        toolArgs: { command: "create", path: `/components/${component.name}.jsx` },
      });
      await delay(500);

      // Create or update App.jsx
      const appCode = getAppCode(component.name);
      if (fileSystem.exists("/App.jsx")) {
        fileSystem.updateFile("/App.jsx", appCode);
      } else {
        fileSystem.createFileWithParents("/App.jsx", appCode);
      }

      await sendEvent({
        type: "agent_tool_call",
        agent: AgentRole.ENGINEER,
        content: "Created /App.jsx",
        toolName: "str_replace_editor",
        toolArgs: { command: "create", path: "/App.jsx" },
      });
      await delay(400);

      await sendEvent({
        type: "agent_done",
        agent: AgentRole.ENGINEER,
        content: "Implementation complete — passing to QA for review",
      });
      await delay(500);

      // --- QA Agent ---
      await sendEvent({
        type: "agent_start",
        agent: AgentRole.QA,
        content: `Reviewing ${component.name} implementation`,
      });
      await delay(600);

      const qaReview = getQAReview(component);
      await sendEvent({
        type: "agent_message",
        agent: AgentRole.QA,
        content: qaReview,
      });
      await delay(400);

      await sendEvent({
        type: "agent_tool_call",
        agent: AgentRole.QA,
        content: "Code approved!",
        toolName: "submit_review",
        toolArgs: { needsRevision: false },
      });
      await delay(300);

      await sendEvent({
        type: "agent_done",
        agent: AgentRole.QA,
        content: "Code approved — all checks passed!",
      });
      await delay(300);

      // --- Workflow done ---
      await sendEvent({
        type: "workflow_done",
        agent: AgentRole.ORCHESTRATOR,
        content: JSON.stringify({
          files: fileSystem.serialize(),
          messageCount: 0,
        }),
      });

      // Save to project if applicable
      if (projectId) {
        const allMessages = [
          ...messages,
          {
            id: `multi-agent-${Date.now()}`,
            role: "assistant",
            content: `Multi-agent workflow completed. Created ${component.name} component with design spec, implementation, and QA review.`,
          },
        ];
        await saveProjectState(projectId, allMessages, fileSystem.serialize());
      }
    } catch (error) {
      console.error("Mock multi-agent workflow error:", error);
      await sendEvent({
        type: "workflow_done",
        agent: AgentRole.ORCHESTRATOR,
        content: JSON.stringify({ error: String(error) }),
      });
    } finally {
      try {
        await writer.close();
      } catch {
        // Already closed
      }
    }
  })();
}
