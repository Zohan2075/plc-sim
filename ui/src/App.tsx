import { useEffect, useState } from "react";
import type { Program } from "@plc-sim/ladder-types";
import { PlcEngine } from "@plc-sim/plc-engine";

import { DiagramBuilder, type CircuitSnapshot, type DiagramFault } from "./DiagramBuilder";
import {
  captureInputValues,
  type ProjectBundle,
  type TagDefinition
} from "./projectData";

function buildBlankProject(): ProjectBundle {
  return {
    version: 1,
    name: "Untitled simulator",
    description: "Blank graphical simulator workspace.",
    program: { rungs: [] },
    tags: [
      { name: "I:0/0", kind: "input", label: "Input" },
      { name: "O:0/0", kind: "output", label: "Output" },
      { name: "B3:0/0", kind: "internal", label: "Internal bit" }
    ],
    settings: { scanIntervalMs: 150 },
    inputValues: { "I:0/0": false }
  };
}

function buildEngine(project: ProjectBundle): PlcEngine {
  const engine = new PlcEngine();

  engine.loadProgram(project.program);

  for (const tag of project.tags) {
    if (tag.kind === "input") {
      engine.setInput(tag.name, project.inputValues[tag.name] ?? tag.initialValue ?? false);
    }
  }

  engine.scanWithTrace();

  return engine;
}

export function App() {
  const [builderProgram, setBuilderProgram] = useState<Program | null>(null);
  const [project, setProject] = useState<ProjectBundle | null>(null);
  const [engine, setEngine] = useState(() => new PlcEngine());
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Preparing blank simulator...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fault, setFault] = useState<DiagramFault | null>(null);

  function applyProject(nextProject: ProjectBundle, nextBuilderProgram: Program | null = null) {
    setRunning(false);
    setBuilderProgram(nextBuilderProgram);
    setProject(nextProject);
    setEngine(buildEngine(nextProject));
    setTick(1);
    setFault(null);
    setErrorMessage(null);
  }

  useEffect(() => {
    applyProject(buildBlankProject());
    setStatusMessage("Blank simulator ready. Add devices only when you need them.");
  }, []);

  useEffect(() => {
    if (!running || !project) {
      return;
    }

    const handle = window.setInterval(() => {
      engine.scanWithTrace();
      setTick((t) => t + 1);
    }, project.settings.scanIntervalMs);

    return () => window.clearInterval(handle);
  }, [engine, project, running]);

  function handleBuilderProgramChange(nextProgram: Program, nextTags?: TagDefinition[]) {
    setBuilderProgram(nextProgram);

    if (!project) {
      return;
    }

    const resolvedTags = nextTags && nextTags.length > 0 ? nextTags : project.tags;

    const nextProject = {
      ...project,
      inputValues: captureInputValues(resolvedTags, (tagName) => engine.getTag(tagName)),
      program: nextProgram,
      tags: resolvedTags
    };

    setRunning(false);
    setEngine(buildEngine(nextProject));
    setTick((currentTick) => (currentTick === 0 ? 1 : currentTick + 1));
    setStatusMessage("Diagram updated. Press Run to simulate the current wiring.");

    if (!fault) {
      setErrorMessage(null);
    }
  }

  function handleCircuitLoad(snapshot: CircuitSnapshot) {
    const defaultProject = buildBlankProject();
    const nextTags = snapshot.tags.length > 0 ? snapshot.tags : defaultProject.tags;
    const nextProject: ProjectBundle = {
      version: project?.version ?? defaultProject.version,
      name: snapshot.name,
      description: project?.description ?? "Loaded graphical circuit snapshot.",
      program: snapshot.program,
      tags: nextTags,
      settings: { scanIntervalMs: snapshot.settings.scanIntervalMs },
      inputValues: captureInputValues(nextTags, (tagName) => engine.getTag(tagName))
    };

    applyProject(nextProject, snapshot.program);
    setStatusMessage(`Loaded ${snapshot.name}.`);
  }

  const activeProject = project ? { ...project, program: builderProgram ?? project.program } : null;
  const activeTagValues = activeProject
    ? activeProject.tags.reduce<Record<string, boolean>>((tagMap, tag) => {
      tagMap[tag.name] = engine.getTag(tag.name);
      return tagMap;
    }, {})
    : {};
  const simulatorLabel = fault ? "Fault" : errorMessage ? "Blocked" : running ? "Running" : activeProject ? "Ready" : "Loading";
  const simulatorMessage = errorMessage
    ?? (activeProject
      ? running
        ? `Simulation is running every ${activeProject.settings.scanIntervalMs} ms.`
        : "Press Run to simulate the current diagram."
      : statusMessage);

  function handleFaultDetected(nextFault: DiagramFault) {
    setFault((currentFault) => currentFault ?? nextFault);
    setErrorMessage(nextFault.message);
    setRunning(false);
    setStatusMessage("Short circuit detected. Correct the loop and reset the fault before running again.");
  }

  function handleFaultReset() {
    setFault(null);
    setErrorMessage(null);
    setStatusMessage("Fault reset. Press Run to simulate the current diagram.");
  }

  function handleRunToggle() {
    if (!activeProject || fault) {
      return;
    }

    setErrorMessage(null);
    setRunning((currentRunning) => {
      const nextRunning = !currentRunning;
      setStatusMessage(nextRunning ? "Simulation running." : "Simulation stopped.");
      return nextRunning;
    });
  }

  return (
    <div className="app-shell app-shell--playground">
      <main className="dashboard dashboard--playground">
        <DiagramBuilder
          fault={fault}
          onCircuitLoad={handleCircuitLoad}
          onFaultDetected={handleFaultDetected}
          onFaultReset={handleFaultReset}
          onProgramChange={handleBuilderProgramChange}
          program={project?.program}
          runDisabled={!activeProject}
          running={running}
          scanIntervalMs={activeProject?.settings.scanIntervalMs ?? 150}
          simulatorLabel={simulatorLabel}
          simulatorMessage={simulatorMessage}
          simulatorTone={fault || errorMessage ? "error" : "info"}
          tags={activeProject?.tags ?? []}
          tagValues={activeTagValues}
          tick={tick}
          onRunToggle={handleRunToggle}
        />
      </main>
    </div>
  );
}
