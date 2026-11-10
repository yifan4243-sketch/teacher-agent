// Generated from desktop/src by scripts/build_desktop.mjs.

// extensions/teacher-assistant/desktop/src/plugin.tsx
import { Button as Button9, host as host3, ROUTES_AREA, SIDEBAR_NAV_AREA, useQuery as useQuery9, useValue } from "@hermes/plugin-sdk";
import { useState as useState8 } from "react";

// extensions/teacher-assistant/desktop/src/records.tsx
import { Button, Input, useMutation, useQuery, useQueryClient } from "@hermes/plugin-sdk";
import { useState } from "react";

// extensions/teacher-assistant/desktop/src/api.ts
import { host } from "@hermes/plugin-sdk";
async function call(route, operation, data = {}, requestId) {
  const response = await host.requestProfile(route, "plugin.teacher-assistant.call", {
    operation,
    data,
    request_id: requestId
  });
  if (!response.ok) {
    throw new Error(response.error?.message ?? "\u6559\u5E08\u670D\u52A1\u672A\u80FD\u5B8C\u6210\u64CD\u4F5C");
  }
  return response.data;
}
function routeKey(route) {
  return ["teacher-assistant", route.connectionId, route.profile, route.targetProfile];
}

// extensions/teacher-assistant/desktop/src/records.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var FIELDS = {
  course: [
    { name: "title", label: "\u8BFE\u7A0B\u540D\u79F0", required: true },
    { name: "subject", label: "\u5B66\u79D1" },
    { name: "level", label: "\u5B66\u751F\u5E74\u7EA7\u4E0E\u57FA\u7840" },
    { name: "objectives", label: "\u6559\u5B66\u76EE\u6807" },
    { name: "period_minutes", label: "\u6BCF\u5C0F\u8282\u6559\u5B66\u5206\u949F", numeric: true, initial: "40" },
    { name: "period_count", label: "\u6BCF\u8BFE\u6B21\u5C0F\u8282\u6570", numeric: true, initial: "2" },
    { name: "break_minutes", label: "\u8BFE\u6B21\u5185\u4F11\u606F\u5408\u8BA1\u5206\u949F", numeric: true, initial: "10" }
  ],
  class: [
    { name: "name", label: "\u73ED\u7EA7\u540D\u79F0", required: true },
    { name: "academic_year", label: "\u5B66\u5E74" }
  ],
  student: [
    { name: "student_number", label: "\u5B66\u53F7", required: true },
    { name: "name", label: "\u5B66\u751F\u59D3\u540D", required: true }
  ]
};
var TITLES = { course: "\u8BFE\u7A0B", class: "\u73ED\u7EA7", student: "\u5B66\u751F" };
function RecordEditor({ route, entity }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const records = useQuery({
    queryKey: [...routeKey(route), entity],
    queryFn: () => call(route, `${entity}.list`, { include_archived: true })
  });
  const classes = useQuery({
    queryKey: [...routeKey(route), "class"],
    queryFn: () => call(route, "class.list", { include_archived: true }),
    enabled: entity === "student"
  });
  const mutation = useMutation({
    mutationFn: ({ operation, data }) => call(route, operation, data, crypto.randomUUID()),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: routeKey(route) });
      setSelected(saved);
      setMessage("\u5DF2\u4FDD\u5B58\u81F3\u672C\u5730\u6559\u5B66\u6570\u636E\u5E93");
    }
  });
  function save(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {};
    for (const field of FIELDS[entity]) {
      const value = String(form.get(field.name) ?? "");
      data[field.name] = field.numeric ? Number(value) : value;
    }
    if (entity === "student") data.class_id = String(form.get("class_id") ?? "");
    if (selected) Object.assign(data, { id: selected.id, version: selected.version });
    setMessage("");
    mutation.mutate({ operation: `${entity}.${selected ? "update" : "create"}`, data });
  }
  return /* @__PURE__ */ jsxs("section", { className: "space-y-5", "aria-label": `${TITLES[entity]}\u7BA1\u7406`, children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("h2", { className: "text-lg font-semibold", children: [
        TITLES[entity],
        "\u7BA1\u7406"
      ] }),
      /* @__PURE__ */ jsxs(Button, { variant: "secondary", onClick: () => {
        setSelected(null);
        setMessage("");
        mutation.reset();
      }, children: [
        "\u65B0\u589E",
        TITLES[entity]
      ] })
    ] }),
    records.isPending && /* @__PURE__ */ jsx("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u6570\u636E\u5E93\u2026" }),
    records.error && /* @__PURE__ */ jsx("p", { role: "alert", children: records.error.message }),
    records.data?.items.length === 0 && /* @__PURE__ */ jsxs("p", { children: [
      "\u8FD8\u6CA1\u6709",
      TITLES[entity],
      "\u8BB0\u5F55\u3002"
    ] }),
    /* @__PURE__ */ jsx("ul", { className: "space-y-2", children: records.data?.items.map((record) => /* @__PURE__ */ jsxs("li", { className: "flex flex-wrap items-center gap-3", children: [
      /* @__PURE__ */ jsxs(Button, { variant: "text", onClick: () => {
        setSelected(record);
        setMessage("");
        mutation.reset();
      }, children: [
        record.title ?? record.name,
        record.archived ? "\uFF08\u5DF2\u5F52\u6863\uFF09" : ""
      ] }),
      entity === "course" && /* @__PURE__ */ jsxs("span", { children: [
        record.period_count,
        "\u5C0F\u8282 \xB7 \u6559\u5B66",
        record.instruction_minutes,
        "\u5206\u949F \xB7 \u5360\u7528",
        record.session_span_minutes,
        "\u5206\u949F"
      ] }),
      entity === "student" && /* @__PURE__ */ jsx("span", { children: record.student_number })
    ] }, record.id)) }),
    /* @__PURE__ */ jsxs("form", { onSubmit: save, className: "grid max-w-2xl gap-4", children: [
      /* @__PURE__ */ jsxs("h3", { className: "font-medium", children: [
        selected ? "\u7F16\u8F91" : "\u521B\u5EFA",
        TITLES[entity]
      ] }),
      FIELDS[entity].map((field) => /* @__PURE__ */ jsxs("label", { className: "grid gap-1 text-sm", children: [
        field.label,
        /* @__PURE__ */ jsx(
          Input,
          {
            name: field.name,
            required: field.required || field.numeric,
            type: field.numeric ? "number" : "text",
            min: field.numeric ? 0 : void 0,
            defaultValue: String(selected?.[field.name] ?? field.initial ?? "")
          }
        )
      ] }, field.name)),
      entity === "student" && /* @__PURE__ */ jsxs("label", { className: "grid gap-1 text-sm", children: [
        "\u6240\u5C5E\u73ED\u7EA7",
        /* @__PURE__ */ jsxs("select", { "aria-label": "\u6240\u5C5E\u73ED\u7EA7", name: "class_id", required: true, defaultValue: selected?.class_id ?? "", className: "rounded-md border bg-transparent p-2", children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "\u8BF7\u9009\u62E9\u73ED\u7EA7" }),
          classes.data?.items.filter((record) => !record.archived || record.id === selected?.class_id).map((record) => /* @__PURE__ */ jsx("option", { value: record.id, children: record.name }, record.id))
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ jsxs(Button, { type: "submit", disabled: mutation.isPending, children: [
          "\u4FDD\u5B58",
          TITLES[entity]
        ] }),
        selected && /* @__PURE__ */ jsx(Button, { type: "button", variant: "secondary", disabled: mutation.isPending, onClick: () => mutation.mutate({
          operation: `${entity}.update`,
          data: { id: selected.id, version: selected.version, archived: !selected.archived }
        }), children: selected.archived ? "\u6062\u590D\u8BB0\u5F55" : "\u5F52\u6863\u8BB0\u5F55" })
      ] }),
      mutation.error && /* @__PURE__ */ jsx("p", { role: "alert", children: mutation.error.message }),
      message && /* @__PURE__ */ jsx("p", { role: "status", children: message })
    ] }, `${entity}:${selected?.id ?? "new"}:${selected?.version ?? 0}`)
  ] });
}
function CourseRoster({ route }) {
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState("");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const courses = useQuery({ queryKey: [...routeKey(route), "course"], queryFn: () => call(route, "course.list", { include_archived: true }) });
  const classes = useQuery({ queryKey: [...routeKey(route), "class"], queryFn: () => call(route, "class.list", { include_archived: true }) });
  const students = useQuery({ queryKey: [...routeKey(route), "student"], queryFn: () => call(route, "student.list", { include_archived: true }) });
  const enrollment = useQuery({ queryKey: [...routeKey(route), "enrollment", courseId], queryFn: () => call(route, "enrollment.list", { course_id: courseId }), enabled: Boolean(courseId) });
  const linked = useQuery({ queryKey: [...routeKey(route), "course-classes", courseId], queryFn: () => call(route, "course.classes", { course_id: courseId }), enabled: Boolean(courseId) });
  const mutation = useMutation({
    mutationFn: ({ operation, data }) => call(route, operation, data, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) })
  });
  const selections = [
    { label: "\u8BFE\u7A0B", value: courseId, set: setCourseId, items: courses.data?.items },
    { label: "\u73ED\u7EA7", value: classId, set: setClassId, items: classes.data?.items },
    { label: "\u5B66\u751F", value: studentId, set: setStudentId, items: students.data?.items }
  ];
  return /* @__PURE__ */ jsxs("section", { className: "space-y-4", "aria-label": "\u8BFE\u7A0B\u8EAB\u4EFD\u5173\u8054", children: [
    /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold", children: "\u8BFE\u7A0B\u4E0E\u5B66\u751F\u5173\u8054" }),
    /* @__PURE__ */ jsx("p", { children: "\u5148\u5173\u8054\u6388\u8BFE\u73ED\u7EA7\uFF0C\u518D\u767B\u8BB0\u5B66\u751F\u9009\u8BFE\u3002\u6B63\u5F0F\u6210\u7EE9\u5C06\u4F7F\u7528\u8BE5\u9009\u8BFE\u8EAB\u4EFD\u3002" }),
    /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-4", children: selections.map((selection) => /* @__PURE__ */ jsxs("label", { className: "grid gap-1", children: [
      selection.label,
      /* @__PURE__ */ jsxs("select", { "aria-label": selection.label, value: selection.value, onChange: (event) => selection.set(event.target.value), className: "rounded-md border bg-transparent p-2", children: [
        /* @__PURE__ */ jsxs("option", { value: "", children: [
          "\u8BF7\u9009\u62E9",
          selection.label
        ] }),
        selection.items?.filter((record) => !record.archived).map((record) => /* @__PURE__ */ jsx("option", { value: record.id, children: record.title ?? record.name }, record.id))
      ] })
    ] }, selection.label)) }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
      /* @__PURE__ */ jsx(Button, { disabled: !courseId || !classId || mutation.isPending, onClick: () => mutation.mutate({ operation: "course.assign_class", data: { course_id: courseId, class_id: classId } }), children: "\u5173\u8054\u73ED\u7EA7" }),
      /* @__PURE__ */ jsx(Button, { disabled: !courseId || !studentId || mutation.isPending, onClick: () => mutation.mutate({ operation: "enrollment.create", data: { course_id: courseId, student_id: studentId } }), children: "\u767B\u8BB0\u9009\u8BFE" })
    ] }),
    linked.data && /* @__PURE__ */ jsxs("p", { children: [
      "\u6388\u8BFE\u73ED\u7EA7 \xB7 ",
      linked.data.items.map((record) => record.name).join("\u3001") || "\u6682\u65E0\u5173\u8054"
    ] }),
    enrollment.data && /* @__PURE__ */ jsxs("p", { children: [
      "\u5DF2\u767B\u8BB0 ",
      enrollment.data.items.length,
      " \u540D\u5B66\u751F"
    ] }),
    [courses.error, classes.error, students.error, enrollment.error, linked.error, mutation.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/settings.tsx
import { Button as Button2, Input as Input2, useMutation as useMutation2, useQuery as useQuery2, useQueryClient as useQueryClient2 } from "@hermes/plugin-sdk";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var STAGES = [
  ["teaching_script", "\u6388\u8BFE\u7A3F"],
  ["lesson_plan", "\u6559\u6848"],
  ["slides", "\u8BFE\u4EF6"],
  ["exams", "\u8BD5\u5377"],
  ["grading", "\u8F85\u52A9\u6279\u6539"],
  ["analysis", "\u5B66\u60C5\u5206\u6790"]
];
function Settings({ route }) {
  const queryClient = useQueryClient2();
  const settings = useQuery2({ queryKey: [...routeKey(route), "settings"], queryFn: () => call(route, "settings.get") });
  const schema = useQuery2({ queryKey: [...routeKey(route), "schema"], queryFn: () => call(route, "schema") });
  const mutation = useMutation2({
    mutationFn: (data) => call(route, "settings.update", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...routeKey(route), "settings"] })
  });
  function save(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stageModels = {};
    for (const [key] of STAGES) {
      const provider = String(form.get(`${key}.provider`) ?? "").trim();
      const model = String(form.get(`${key}.model`) ?? "").trim();
      if (provider || model) stageModels[key] = { provider, model };
    }
    mutation.mutate({ agent_student_access: form.has("student_access"), semantic_llm_enabled: form.has("semantic_llm"), disabled_operations: form.getAll("disabled_operation").map(String), stage_models: stageModels });
  }
  return /* @__PURE__ */ jsxs2("section", { className: "space-y-5", "aria-label": "\u6A21\u578B\u4E0E\u6743\u9650\u8BBE\u7F6E", children: [
    /* @__PURE__ */ jsx2("h2", { className: "text-lg font-semibold", children: "\u6A21\u578B\u4E0E\u5DE5\u5177\u6743\u9650" }),
    /* @__PURE__ */ jsx2("p", { children: "\u51ED\u636E\u901A\u8FC7 Hermes \u7CFB\u7EDF\u8BBE\u7F6E\u7BA1\u7406\u3002\u6B64\u5904\u53EA\u4FDD\u5B58\u9636\u6BB5\u6A21\u578B\u540D\u79F0\u548C\u6743\u9650\u3002" }),
    settings.data && /* @__PURE__ */ jsxs2("form", { onSubmit: save, className: "max-w-3xl space-y-6", children: [
      /* @__PURE__ */ jsxs2("label", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx2("input", { type: "checkbox", name: "student_access", defaultChecked: settings.data.agent_student_access }),
        "\u5141\u8BB8 Agent \u8BBF\u95EE\u672C\u5730\u5B66\u751F\u8D44\u6599"
      ] }),
      /* @__PURE__ */ jsxs2("label", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx2("input", { type: "checkbox", name: "semantic_llm", defaultChecked: settings.data.semantic_llm_enabled }),
        "\u542F\u7528\u6309\u9700\u8BED\u4E49\u68C0\u7D22\uFF0C\u5141\u8BB8\u5C06\u6559\u6750\u5019\u9009\u7247\u6BB5\u53D1\u9001\u7ED9 Hermes \u5F53\u524D\u6A21\u578B\uFF0C\u6BCF\u6B21\u6700\u591A\u4E24\u6B21\u6A21\u578B\u8BF7\u6C42\uFF0C\u53EF\u80FD\u4EA7\u751F API \u8D39\u7528"
      ] }),
      /* @__PURE__ */ jsxs2("fieldset", { className: "space-y-3", children: [
        /* @__PURE__ */ jsx2("legend", { className: "mb-3 font-medium", children: "\u5206\u9636\u6BB5\u6A21\u578B" }),
        STAGES.map(([key, label]) => /* @__PURE__ */ jsxs2("div", { className: "grid gap-2 sm:grid-cols-3", children: [
          /* @__PURE__ */ jsx2("span", { children: label }),
          /* @__PURE__ */ jsx2(Input2, { "aria-label": `${label}\u670D\u52A1\u5546`, name: `${key}.provider`, placeholder: "\u670D\u52A1\u5546", defaultValue: settings.data.stage_models[key]?.provider ?? "" }),
          /* @__PURE__ */ jsx2(Input2, { "aria-label": `${label}\u6A21\u578B`, name: `${key}.model`, placeholder: "\u6A21\u578B\u540D\u79F0", defaultValue: settings.data.stage_models[key]?.model ?? "" })
        ] }, key))
      ] }),
      /* @__PURE__ */ jsxs2("fieldset", { className: "grid gap-2", children: [
        /* @__PURE__ */ jsx2("legend", { className: "mb-3 font-medium", children: "\u7981\u7528\u7684 Agent \u64CD\u4F5C" }),
        schema.data && Object.keys(schema.data).map((operation) => /* @__PURE__ */ jsxs2("label", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsx2("input", { type: "checkbox", name: "disabled_operation", value: operation, defaultChecked: settings.data.disabled_operations.includes(operation) }),
          operation
        ] }, operation))
      ] }),
      /* @__PURE__ */ jsx2(Button2, { type: "submit", disabled: mutation.isPending, children: "\u4FDD\u5B58\u6A21\u578B\u4E0E\u6743\u9650" }),
      mutation.isSuccess && /* @__PURE__ */ jsx2("p", { role: "status", children: "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58" })
    ] }, JSON.stringify(settings.data)),
    [settings.error, schema.error, mutation.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx2("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/tasks.tsx
import { Button as Button3, Input as Input3, useMutation as useMutation3, useQuery as useQuery3, useQueryClient as useQueryClient3 } from "@hermes/plugin-sdk";
import { useState as useState2 } from "react";
import { Fragment, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var STATUS = {
  pending: "\u5F85\u6267\u884C",
  running: "\u6267\u884C\u4E2D",
  awaiting_review: "\u5F85\u6559\u5E08\u5BA1\u6838",
  completed: "\u5DF2\u5B8C\u6210",
  failed: "\u5931\u8D25",
  cancelled: "\u5DF2\u53D6\u6D88"
};
function Tasks({ route }) {
  const [title, setTitle] = useState2("");
  const queryClient = useQueryClient3();
  const tasks = useQuery3({ queryKey: [...routeKey(route), "tasks"], queryFn: () => call(route, "task.list") });
  const mutation = useMutation3({
    mutationFn: ({ operation, data }) => call(route, operation, data, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) })
  });
  return /* @__PURE__ */ jsxs3("section", { className: "space-y-5", "aria-label": "\u4EFB\u52A1\u4E0E\u5BA1\u6279", children: [
    /* @__PURE__ */ jsx3("h2", { className: "text-lg font-semibold", children: "\u4EFB\u52A1\u4E0E\u6559\u5E08\u5BA1\u6279" }),
    /* @__PURE__ */ jsxs3("form", { className: "flex max-w-2xl gap-3", onSubmit: (event) => {
      event.preventDefault();
      mutation.mutate({ operation: "task.create", data: { kind: "course_setup", course: { title } } });
    }, children: [
      /* @__PURE__ */ jsx3(Input3, { "aria-label": "\u65B0\u4EFB\u52A1\u8BFE\u7A0B\u540D\u79F0", required: true, value: title, onChange: (event) => setTitle(event.target.value), placeholder: "\u8BFE\u7A0B\u540D\u79F0" }),
      /* @__PURE__ */ jsx3(Button3, { type: "submit", disabled: mutation.isPending, children: "\u5EFA\u7ACB\u8BFE\u7A0B\u4EFB\u52A1" })
    ] }),
    tasks.isPending && /* @__PURE__ */ jsx3("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u4EFB\u52A1\u2026" }),
    tasks.data?.items.length === 0 && /* @__PURE__ */ jsx3("p", { children: "\u6682\u65E0\u4EFB\u52A1\u3002Agent \u521B\u5EFA\u7684\u4EFB\u52A1\u4E5F\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" }),
    /* @__PURE__ */ jsx3("ul", { className: "space-y-6", children: tasks.data?.items.map((task) => /* @__PURE__ */ jsxs3("li", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxs3("h3", { className: "font-medium", children: [
        task.input.title,
        " \xB7 ",
        STATUS[task.status] ?? task.status
      ] }),
      /* @__PURE__ */ jsxs3("p", { className: "text-sm text-(--ui-text-tertiary)", children: [
        task.id,
        " \xB7 \u7248\u672C",
        task.version
      ] }),
      /* @__PURE__ */ jsxs3("p", { children: [
        "\u5DF2\u6301\u4E45\u4FDD\u5B58\u6B65\u9AA4 \xB7 ",
        task.steps.map((step) => step.step_key).join("\u3001") || "\u6682\u65E0"
      ] }),
      task.error && /* @__PURE__ */ jsx3("p", { role: "alert", children: task.error }),
      /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap gap-3", children: [
        task.status === "pending" && task.kind === "course_setup" && /* @__PURE__ */ jsx3(Button3, { disabled: mutation.isPending, onClick: () => mutation.mutate({ operation: "task.run", data: { id: task.id } }), children: "\u6267\u884C\u4EFB\u52A1" }),
        task.status === "failed" && /* @__PURE__ */ jsx3(Button3, { disabled: mutation.isPending, onClick: () => mutation.mutate({ operation: "task.retry", data: { id: task.id, version: task.version } }), children: "\u51C6\u5907\u91CD\u8BD5" }),
        task.status === "awaiting_review" && task.kind === "course_setup" && /* @__PURE__ */ jsxs3(Fragment, { children: [
          /* @__PURE__ */ jsx3(Button3, { disabled: mutation.isPending, onClick: () => mutation.mutate({ operation: "task.review", data: { id: task.id, version: task.version, decision: "approved" } }), children: "\u6559\u5E08\u6279\u51C6" }),
          /* @__PURE__ */ jsx3(Button3, { variant: "secondary", disabled: mutation.isPending, onClick: () => mutation.mutate({ operation: "task.review", data: { id: task.id, version: task.version, decision: "rejected" } }), children: "\u9000\u56DE\u4EFB\u52A1" })
        ] }),
        task.kind === "document_generation" && /* @__PURE__ */ jsx3("p", { children: "\u8BF7\u5728\u201C\u6388\u8BFE\u7A3F\u4E0E\u6559\u6848\u201D\u67E5\u770BAgent\u4F1A\u8BDD\u3001\u5168\u6587\u53CA\u5BA1\u6838\u7248\u672C\u3002" }),
        ["pending", "failed", "awaiting_review"].includes(task.status) && /* @__PURE__ */ jsx3(Button3, { variant: "secondary", disabled: mutation.isPending, onClick: () => mutation.mutate({ operation: "task.cancel", data: { id: task.id, version: task.version } }), children: "\u53D6\u6D88\u4EFB\u52A1" })
      ] })
    ] }, task.id)) }),
    [tasks.error, mutation.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx3("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/textbooks.tsx
import { Button as Button5, Input as Input5, useMutation as useMutation5, useQuery as useQuery5, useQueryClient as useQueryClient5 } from "@hermes/plugin-sdk";
import { useState as useState4 } from "react";

// extensions/teacher-assistant/desktop/src/textbook-api.ts
async function uploadTextbook(route, file, courseId, title, textbookId, progress) {
  if (file.size === 0 || file.size > 50 * 1024 * 1024) throw new Error("\u6559\u6750\u6587\u4EF6\u9700\u5927\u4E8E0\u4E14\u4E0D\u8D85\u8FC750MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const sha256 = Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const requestId = crypto.randomUUID();
  const upload = await call(route, "textbook.upload.begin", {
    course_id: courseId,
    textbook_id: textbookId || null,
    title,
    filename: file.name,
    total_bytes: bytes.length,
    sha256
  }, `${requestId}:begin`);
  for (let offset = 0; offset < bytes.length; offset += 128 * 1024) {
    const chunk = bytes.subarray(offset, offset + 128 * 1024);
    let binary = "";
    for (const byte of chunk) binary += String.fromCharCode(byte);
    await call(route, "textbook.upload.chunk", { id: upload.id, offset, content_base64: btoa(binary) }, `${requestId}:${offset}`);
    progress(`\u5DF2\u4E0A\u4F20 ${Math.round((offset + chunk.length) / bytes.length * 100)}%`);
  }
  progress("\u6B63\u5728\u89E3\u6790\u6559\u6750\u5E76\u5EFA\u7ACB\u7D22\u5F15\u2026");
  return call(route, "textbook.upload.finish", { id: upload.id }, `${requestId}:finish`);
}

// extensions/teacher-assistant/desktop/src/textbook-version.tsx
import { Button as Button4, Input as Input4, useMutation as useMutation4, useQuery as useQuery4, useQueryClient as useQueryClient4 } from "@hermes/plugin-sdk";
import { useState as useState3 } from "react";
import { Fragment as Fragment2, jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function TextbookVersion({ route, versionId, onSearch, searchPending }) {
  const queryClient = useQueryClient4();
  const [offset, setOffset] = useState3(0);
  const [sourceId, setSourceId] = useState3("");
  const version = useQuery4({ queryKey: [...routeKey(route), "version", versionId], queryFn: () => call(route, "textbook.version", { id: versionId }), enabled: !!versionId });
  const points = useQuery4({ queryKey: [...routeKey(route), "knowledge", versionId, offset], queryFn: () => call(route, "knowledge.list", { version_id: versionId, offset, limit: 20 }), enabled: !!versionId });
  const source = useQuery4({ queryKey: [...routeKey(route), "source", sourceId], queryFn: () => call(route, "source.get", { id: sourceId }), enabled: !!sourceId });
  const update = useMutation4({
    mutationFn: ({ operation, id, title }) => call(route, operation, { id, title }, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) })
  });
  function rename(event, operation, id) {
    event.preventDefault();
    update.mutate({ operation, id, title: String(new FormData(event.currentTarget).get("title")) });
  }
  return /* @__PURE__ */ jsxs4("div", { className: "space-y-5", children: [
    version.data && /* @__PURE__ */ jsxs4(Fragment2, { children: [
      /* @__PURE__ */ jsxs4("p", { children: [
        "\u539F\u6587\u7247\u6BB5 ",
        version.data.metadata.source_unit_count,
        " \xB7 \u77E5\u8BC6\u70B9\u5019\u9009 ",
        version.data.knowledge_point_count
      ] }),
      /* @__PURE__ */ jsxs4("p", { className: "break-all text-sm", children: [
        "SHA-256 ",
        version.data.sha256
      ] }),
      version.data.metadata.warnings.map((warning) => /* @__PURE__ */ jsx4("p", { role: "note", children: warning }, warning)),
      version.data.metadata.toc.length > 0 && /* @__PURE__ */ jsxs4("details", { children: [
        /* @__PURE__ */ jsx4("summary", { children: "\u539F\u4E66\u76EE\u5F55\u7684\u5F85\u6838\u9A8C\u9875\u7801" }),
        version.data.metadata.toc.map((item, index) => /* @__PURE__ */ jsxs4("p", { children: [
          item.title,
          " \xB7 \u5370\u5237\u9875\u7801\u63D0\u793A ",
          item.printed_page_hint,
          " \xB7 \u5C1A\u672A\u6838\u9A8C"
        ] }, index))
      ] }),
      /* @__PURE__ */ jsxs4("details", { open: true, children: [
        /* @__PURE__ */ jsx4("summary", { children: "\u7AE0\u8282\u7ED3\u6784\u4E0E\u4FEE\u8BA2" }),
        /* @__PURE__ */ jsx4("div", { className: "space-y-2", children: version.data.chapters.map((chapter) => /* @__PURE__ */ jsxs4("form", { className: "flex gap-2", style: { marginLeft: `${Math.min(chapter.level - 1, 5) * 16}px` }, onSubmit: (event) => rename(event, "chapter.update", chapter.id), children: [
          /* @__PURE__ */ jsx4(Input4, { "aria-label": `\u7AE0\u8282\u540D\u79F0 ${chapter.title}`, name: "title", defaultValue: chapter.title, maxLength: 200, required: true }),
          /* @__PURE__ */ jsx4(Button4, { type: "submit", variant: "secondary", disabled: update.isPending, children: "\u4FEE\u8BA2\u7AE0\u8282" })
        ] }, chapter.id)) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs4("form", { onSubmit: onSearch, className: "grid max-w-xl gap-3", children: [
      /* @__PURE__ */ jsxs4("label", { children: [
        "\u6559\u6750\u68C0\u7D22\u8BCD",
        /* @__PURE__ */ jsx4(Input4, { "aria-label": "\u6559\u6750\u68C0\u7D22\u8BCD", name: "query", required: true, maxLength: 300 })
      ] }),
      /* @__PURE__ */ jsxs4("label", { children: [
        "\u68C0\u7D22\u7AE0\u8282",
        /* @__PURE__ */ jsxs4("select", { "aria-label": "\u68C0\u7D22\u7AE0\u8282", name: "chapter_id", children: [
          /* @__PURE__ */ jsx4("option", { value: "", children: "\u5168\u90E8\u7AE0\u8282" }),
          version.data?.chapters.map((chapter) => /* @__PURE__ */ jsx4("option", { value: chapter.id, children: chapter.title }, chapter.id))
        ] })
      ] }),
      /* @__PURE__ */ jsxs4("label", { className: "flex items-start gap-2", children: [
        /* @__PURE__ */ jsx4("input", { type: "checkbox", name: "semantic" }),
        "\u672C\u6B21\u4F7F\u7528\u8BED\u4E49\u68C0\u7D22\uFF0C\u5141\u8BB8\u6A21\u578B\u5904\u7406\u6559\u6750\u5019\u9009\u7247\u6BB5\uFF0C\u9700\u5148\u542F\u7528\u6743\u9650\uFF0C\u53EF\u80FD\u4EA7\u751F\u8D39\u7528"
      ] }),
      /* @__PURE__ */ jsx4(Button4, { type: "submit", disabled: searchPending, children: "\u68C0\u7D22\u6559\u6750" })
    ] }),
    points.data && /* @__PURE__ */ jsxs4("details", { open: true, children: [
      /* @__PURE__ */ jsxs4("summary", { children: [
        "\u77E5\u8BC6\u70B9\u5019\u9009\u4E0E\u6559\u5E08\u590D\u6838 \xB7 \u5171 ",
        points.data.total,
        " \u9879"
      ] }),
      /* @__PURE__ */ jsx4("p", { children: "\u4EE5\u4E0B\u5185\u5BB9\u7531\u539F\u6587\u89C4\u5219\u63D0\u53D6\uFF0C\u6559\u5E08\u53EF\u4FEE\u8BA2\u540D\u79F0\u5E76\u786E\u8BA4\u3002" }),
      points.data.items.map((point) => /* @__PURE__ */ jsxs4("article", { className: "my-3 rounded border border-(--ui-border) p-3", children: [
        /* @__PURE__ */ jsx4("p", { className: "whitespace-pre-wrap", children: point.text }),
        /* @__PURE__ */ jsxs4("form", { className: "mt-3 flex gap-2", onSubmit: (event) => rename(event, "knowledge.review", point.id), children: [
          /* @__PURE__ */ jsx4(Input4, { "aria-label": `\u77E5\u8BC6\u70B9\u540D\u79F0 ${point.id}`, name: "title", defaultValue: point.title, required: true, maxLength: 200 }),
          /* @__PURE__ */ jsx4(Button4, { type: "submit", disabled: update.isPending, children: point.review_status === "reviewed" ? "\u66F4\u65B0\u786E\u8BA4" : "\u6559\u5E08\u786E\u8BA4" }),
          /* @__PURE__ */ jsx4(Button4, { type: "button", variant: "secondary", onClick: () => setSourceId(point.source_id), children: "\u67E5\u770B\u539F\u6587" })
        ] })
      ] }, point.id)),
      /* @__PURE__ */ jsxs4("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx4(Button4, { disabled: offset === 0, onClick: () => setOffset(Math.max(0, offset - 20)), children: "\u4E0A\u4E00\u7EC4\u77E5\u8BC6\u70B9" }),
        /* @__PURE__ */ jsx4(Button4, { disabled: points.data.next_offset == null, onClick: () => setOffset(points.data?.next_offset ?? 0), children: "\u4E0B\u4E00\u7EC4\u77E5\u8BC6\u70B9" })
      ] })
    ] }),
    source.data && /* @__PURE__ */ jsxs4("aside", { "aria-label": "\u77E5\u8BC6\u70B9\u539F\u6587", className: "rounded border border-(--ui-border) p-4", children: [
      /* @__PURE__ */ jsx4("p", { className: "whitespace-pre-wrap", children: source.data.text }),
      /* @__PURE__ */ jsxs4("p", { children: [
        source.data.filename,
        " \xB7 v",
        source.data.version,
        " \xB7 ",
        source.data.locator
      ] }),
      /* @__PURE__ */ jsxs4("p", { children: [
        "\u6765\u6E90ID ",
        source.data.id
      ] })
    ] }),
    [version.error, points.error, source.error, update.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx4("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/textbooks.tsx
import { Fragment as Fragment3, jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function Textbooks({ route }) {
  const queryClient = useQueryClient5();
  const [courseId, setCourseId] = useState4("");
  const [versionId, setVersionId] = useState4("");
  const [progress, setProgress] = useState4("");
  const [results, setResults] = useState4(null);
  const courses = useQuery5({ queryKey: [...routeKey(route), "course"], queryFn: () => call(route, "course.list") });
  const books = useQuery5({ queryKey: [...routeKey(route), "textbooks", courseId], queryFn: () => call(route, "textbook.list", { course_id: courseId }), enabled: !!courseId });
  const upload = useMutation5({
    mutationFn: ({ file, title, textbookId }) => uploadTextbook(route, file, courseId, title, textbookId, setProgress),
    onSuccess: async (version) => {
      await queryClient.invalidateQueries({ queryKey: [...routeKey(route), "textbooks"] });
      setVersionId(version.id);
      setProgress("\u6559\u6750\u5DF2\u4FDD\u5B58\uFF0C\u539F\u59CB\u6587\u4EF6\u548C\u7248\u672C\u54C8\u5E0C\u5DF2\u4FDD\u7559");
    }
  });
  const search = useMutation5({
    mutationFn: ({ query, semantic, chapterId }) => call(route, semantic ? "knowledge.semantic" : "knowledge.search", {
      course_id: courseId,
      query,
      version_id: versionId || null,
      chapter_id: chapterId || null,
      ...semantic ? { allow_model_call: true } : {}
    }),
    onSuccess: setResults
  });
  function submitUpload(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    setProgress("\u6B63\u5728\u8BA1\u7B97\u6587\u4EF6\u54C8\u5E0C\u2026");
    upload.mutate({ file, title: String(form.get("title")), textbookId: String(form.get("textbook_id") ?? "") });
  }
  function submitSearch(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setResults(null);
    search.mutate({ query: String(form.get("query")), semantic: form.has("semantic"), chapterId: String(form.get("chapter_id") ?? "") });
  }
  return /* @__PURE__ */ jsxs5("section", { className: "space-y-5", "aria-label": "\u6559\u6750\u77E5\u8BC6\u5E93\u7BA1\u7406", children: [
    /* @__PURE__ */ jsx5("h2", { className: "text-lg font-semibold", children: "\u6559\u6750\u77E5\u8BC6\u5E93" }),
    /* @__PURE__ */ jsxs5("label", { className: "grid max-w-xl gap-2", children: [
      "\u6559\u6750\u6240\u5C5E\u8BFE\u7A0B",
      /* @__PURE__ */ jsxs5("select", { "aria-label": "\u6559\u6750\u6240\u5C5E\u8BFE\u7A0B", value: courseId, onChange: (event) => {
        setCourseId(event.target.value);
        setVersionId("");
        setResults(null);
        setProgress("");
      }, disabled: upload.isPending, children: [
        /* @__PURE__ */ jsx5("option", { value: "", children: "\u9009\u62E9\u8BFE\u7A0B" }),
        courses.data?.items.map((course) => /* @__PURE__ */ jsx5("option", { value: course.id, children: course.title }, course.id))
      ] })
    ] }),
    courseId && /* @__PURE__ */ jsxs5(Fragment3, { children: [
      /* @__PURE__ */ jsxs5("form", { onSubmit: submitUpload, className: "grid max-w-xl gap-3", children: [
        /* @__PURE__ */ jsxs5("label", { children: [
          "\u6559\u6750\u540D\u79F0",
          /* @__PURE__ */ jsx5(Input5, { name: "title", "aria-label": "\u6559\u6750\u540D\u79F0", required: true, maxLength: 200 })
        ] }),
        /* @__PURE__ */ jsxs5("label", { children: [
          "\u6559\u6750\u6587\u4EF6",
          /* @__PURE__ */ jsx5("input", { "aria-label": "\u6559\u6750\u6587\u4EF6", name: "file", type: "file", accept: ".pdf,.docx,.pptx,.txt", required: true })
        ] }),
        /* @__PURE__ */ jsxs5("label", { children: [
          "\u7248\u672C\u5F52\u5C5E",
          /* @__PURE__ */ jsxs5("select", { "aria-label": "\u7248\u672C\u5F52\u5C5E", name: "textbook_id", children: [
            /* @__PURE__ */ jsx5("option", { value: "", children: "\u4F5C\u4E3A\u65B0\u6559\u6750\u5BFC\u5165" }),
            books.data?.items.map((book) => /* @__PURE__ */ jsxs5("option", { value: book.id, children: [
              "\u65B0\u589E\u300A",
              book.title,
              "\u300B\u7248\u672C"
            ] }, book.id))
          ] })
        ] }),
        /* @__PURE__ */ jsx5(Button5, { type: "submit", disabled: upload.isPending, children: "\u4E0A\u4F20\u5E76\u89E3\u6790\u6559\u6750" }),
        progress && /* @__PURE__ */ jsx5("p", { role: "status", children: progress })
      ] }),
      books.data?.items.length === 0 && /* @__PURE__ */ jsx5("p", { children: "\u8FD9\u95E8\u8BFE\u7A0B\u8FD8\u6CA1\u6709\u6559\u6750\u3002" }),
      /* @__PURE__ */ jsxs5("label", { className: "grid max-w-xl gap-2", children: [
        "\u6559\u6750\u7248\u672C",
        /* @__PURE__ */ jsxs5("select", { "aria-label": "\u6559\u6750\u7248\u672C", value: versionId, onChange: (event) => {
          setVersionId(event.target.value);
          setResults(null);
        }, children: [
          /* @__PURE__ */ jsx5("option", { value: "", children: "\u68C0\u7D22\u5404\u6559\u6750\u6700\u65B0\u7248\u672C" }),
          books.data?.items.flatMap((book) => book.versions.map((version) => /* @__PURE__ */ jsxs5("option", { value: version.id, children: [
            book.title,
            " \xB7 v",
            version.version,
            " \xB7 ",
            version.filename
          ] }, version.id)))
        ] })
      ] }),
      /* @__PURE__ */ jsx5(TextbookVersion, { route, versionId, onSearch: submitSearch, searchPending: search.isPending }, versionId),
      results && /* @__PURE__ */ jsxs5("div", { className: "space-y-3", "aria-label": "\u6559\u6750\u68C0\u7D22\u7ED3\u679C", children: [
        /* @__PURE__ */ jsxs5("p", { role: "status", children: [
          "\u68C0\u7D22\u5230 ",
          results.items.length,
          " \u6761\u6765\u6E90 \xB7 ",
          results.mode === "full_text" ? "\u5168\u6587\u68C0\u7D22" : "\u6A21\u578B\u8BED\u4E49\u68C0\u7D22"
        ] }),
        results.scope_note && /* @__PURE__ */ jsx5("p", { children: results.scope_note }),
        results.usage?.map((usage, index) => /* @__PURE__ */ jsxs5("p", { children: [
          usage.provider,
          " \xB7 ",
          usage.model,
          " \xB7 ",
          usage.cost_usd == null ? "\u670D\u52A1\u5546\u672A\u8FD4\u56DE\u8D39\u7528" : `$${usage.cost_usd}`
        ] }, index)),
        results.items.map((source) => /* @__PURE__ */ jsxs5("article", { className: "rounded border border-(--ui-border) p-4", children: [
          /* @__PURE__ */ jsx5("p", { className: "whitespace-pre-wrap", children: source.text }),
          /* @__PURE__ */ jsxs5("p", { className: "mt-2 text-sm", children: [
            source.filename,
            " \xB7 v",
            source.version,
            " \xB7 ",
            source.locator,
            " \xB7 \u6765\u6E90ID ",
            source.id
          ] })
        ] }, source.id))
      ] })
    ] }),
    [courses.error, books.error, upload.error, search.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx5("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/preparation.tsx
import { Button as Button8, useMutation as useMutation8, useQuery as useQuery8, useQueryClient as useQueryClient7 } from "@hermes/plugin-sdk";
import { useEffect, useState as useState7 } from "react";

// extensions/teacher-assistant/desktop/src/lesson-editor.tsx
import { Button as Button6, Input as Input6, useMutation as useMutation6, useQuery as useQuery6 } from "@hermes/plugin-sdk";
import { useState as useState5 } from "react";
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
function LessonEditor({ route, courseId, onSaved }) {
  const [versionId, setVersionId] = useState5("");
  const [selected, setSelected] = useState5([]);
  const [offset, setOffset] = useState5(0);
  const books = useQuery6({ queryKey: [...routeKey(route), "textbooks", courseId], queryFn: () => call(route, "textbook.list", { course_id: courseId }) });
  const sources = useQuery6({ queryKey: [...routeKey(route), "lesson-sources", versionId, offset], queryFn: () => call(route, "source.list", { version_id: versionId, offset, limit: 20 }), enabled: !!versionId });
  const save = useMutation6({ mutationFn: (data) => call(route, "lesson.create", data, crypto.randomUUID()), onSuccess: onSaved });
  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    save.mutate({
      course_id: courseId,
      version_id: versionId,
      source_ids: selected,
      title: String(form.get("title")),
      objectives: String(form.get("objectives")),
      key_points: String(form.get("key_points")),
      difficulties: String(form.get("difficulties"))
    });
  }
  return /* @__PURE__ */ jsxs6("details", { className: "rounded border border-(--ui-border) p-4", children: [
    /* @__PURE__ */ jsx6("summary", { children: "\u521B\u5EFA\u6559\u6750\u5173\u8054\u8BFE\u6B21" }),
    /* @__PURE__ */ jsxs6("form", { onSubmit: submit, className: "mt-4 grid max-w-3xl gap-3", children: [
      /* @__PURE__ */ jsxs6("label", { children: [
        "\u8BFE\u6B21\u540D\u79F0",
        /* @__PURE__ */ jsx6(Input6, { "aria-label": "\u8BFE\u6B21\u540D\u79F0", name: "title", required: true, maxLength: 200 })
      ] }),
      /* @__PURE__ */ jsxs6("label", { children: [
        "\u8BFE\u6B21\u6559\u5B66\u76EE\u6807",
        /* @__PURE__ */ jsx6(Input6, { "aria-label": "\u8BFE\u6B21\u6559\u5B66\u76EE\u6807", name: "objectives", maxLength: 12e3 })
      ] }),
      /* @__PURE__ */ jsxs6("label", { children: [
        "\u8BFE\u6B21\u6559\u5B66\u91CD\u70B9",
        /* @__PURE__ */ jsx6(Input6, { "aria-label": "\u8BFE\u6B21\u6559\u5B66\u91CD\u70B9", name: "key_points", maxLength: 12e3 })
      ] }),
      /* @__PURE__ */ jsxs6("label", { children: [
        "\u8BFE\u6B21\u6559\u5B66\u96BE\u70B9",
        /* @__PURE__ */ jsx6(Input6, { "aria-label": "\u8BFE\u6B21\u6559\u5B66\u96BE\u70B9", name: "difficulties", maxLength: 12e3 })
      ] }),
      /* @__PURE__ */ jsxs6("label", { children: [
        "\u8BFE\u6B21\u6559\u6750\u7248\u672C",
        /* @__PURE__ */ jsxs6("select", { "aria-label": "\u8BFE\u6B21\u6559\u6750\u7248\u672C", value: versionId, onChange: (event) => {
          setVersionId(event.target.value);
          setSelected([]);
          setOffset(0);
        }, required: true, children: [
          /* @__PURE__ */ jsx6("option", { value: "", children: "\u9009\u62E9\u56FA\u5B9A\u6559\u6750\u7248\u672C" }),
          books.data?.items.flatMap((book) => book.versions.map((version) => /* @__PURE__ */ jsxs6("option", { value: version.id, children: [
            book.title,
            " \xB7 v",
            version.version
          ] }, version.id)))
        ] })
      ] }),
      /* @__PURE__ */ jsxs6("fieldset", { className: "space-y-3", children: [
        /* @__PURE__ */ jsxs6("legend", { children: [
          "\u9009\u53D6\u672C\u8BFE\u6B21\u539F\u6587\u4F9D\u636E \xB7 \u5DF2\u9009 ",
          selected.length,
          " \u6761\uFF0C\u6700\u591A100\u6761"
        ] }),
        sources.data?.items.map((source) => /* @__PURE__ */ jsxs6("label", { className: "flex items-start gap-2", children: [
          /* @__PURE__ */ jsx6("input", { type: "checkbox", "aria-label": `\u9009\u62E9\u6765\u6E90 ${source.locator}`, checked: selected.includes(source.id), onChange: (event) => setSelected(event.target.checked ? [...selected, source.id] : selected.filter((id) => id !== source.id)) }),
          /* @__PURE__ */ jsxs6("span", { children: [
            source.text,
            /* @__PURE__ */ jsx6("span", { className: "block text-sm", children: source.locator })
          ] })
        ] }, source.id))
      ] }),
      sources.data && /* @__PURE__ */ jsxs6("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx6(Button6, { type: "button", disabled: offset === 0, onClick: () => setOffset(Math.max(0, offset - 20)), children: "\u4E0A\u4E00\u7EC4\u6765\u6E90" }),
        /* @__PURE__ */ jsx6(Button6, { type: "button", disabled: sources.data.next_offset == null, onClick: () => setOffset(sources.data?.next_offset ?? 0), children: "\u4E0B\u4E00\u7EC4\u6765\u6E90" })
      ] }),
      /* @__PURE__ */ jsx6(Button6, { type: "submit", disabled: save.isPending || selected.length === 0 || selected.length > 100, children: "\u4FDD\u5B58\u8BFE\u6B21\u4E0E\u6559\u6750\u4F9D\u636E" })
    ] }),
    [books.error, sources.error, save.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx6("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/teaching-document.tsx
import { Button as Button7, useMutation as useMutation7, useQuery as useQuery7, useQueryClient as useQueryClient6 } from "@hermes/plugin-sdk";
import { useState as useState6 } from "react";

// extensions/teacher-assistant/desktop/src/preparation-api.ts
import { captureGatewayFileDownload, host as host2 } from "@hermes/plugin-sdk";
async function openGeneration(route, generation) {
  if (generation.task.status !== "pending") {
    if (!generation.stored_session_id) throw new Error("\u6B64\u4EFB\u52A1\u5C1A\u672A\u7ED1\u5B9AAgent\u4F1A\u8BDD");
    await host2.openSession(generation.stored_session_id, { route, profile: route.profile, intent: "tab", awaitHydration: true });
    return;
  }
  const release = await host2.retainProfile(route, { spawnPriority: "foreground" });
  try {
    const session = await host2.requestProfile(route, "session.create", {
      profile: route.targetProfile,
      title: generation.task.input.title,
      request_id: generation.workflow_id,
      ...generation.model
    });
    await call(route, "document.generation.claim", { id: generation.workflow_id, runtime_session_id: session.session_id, stored_session_id: session.stored_session_id }, `${generation.workflow_id}:claim`);
    await host2.requestProfile(route, "prompt.submit", { session_id: session.session_id, text: generation.prompt, input_id: generation.workflow_id }, 12e4);
    await host2.openSession(session.stored_session_id, { route, profile: route.profile, intent: "tab", awaitHydration: true, hydrationTimeoutMs: 9e4 });
  } finally {
    release();
  }
}
async function downloadDocument(route, documentId) {
  const save = captureGatewayFileDownload();
  const exported = await call(route, "document.export", { id: documentId }, crypto.randomUUID());
  await save(exported.stored_path, exported.filename);
}

// extensions/teacher-assistant/desktop/src/teaching-document.tsx
import { Fragment as Fragment4, jsx as jsx7, jsxs as jsxs7 } from "react/jsx-runtime";
var PLAN_FIELDS = [
  ["title", "\u6559\u6848\u8BFE\u9898"],
  ["objectives", "\u6559\u5B66\u76EE\u6807"],
  ["key_points", "\u6559\u5B66\u91CD\u70B9"],
  ["difficulties", "\u6559\u5B66\u96BE\u70B9"],
  ["preparation", "\u8BFE\u524D\u51C6\u5907"],
  ["summary", "\u8BFE\u5802\u603B\u7ED3"],
  ["values_education", "\u8BFE\u7A0B\u601D\u653F"],
  ["homework", "\u4F5C\u4E1A\u5E03\u7F6E"],
  ["blackboard", "\u677F\u4E66\u8BBE\u8BA1"],
  ["teaching_week", "\u9884\u6388\u8BFE\u5468"],
  ["lesson_numbers", "\u8BFE\u7A0B\u8BFE\u65F6\u5E8F\u53F7"]
];
function DocumentEditor({ route, documentId, onVersion }) {
  const queryClient = useQueryClient6();
  const [confirmed, setConfirmed] = useState6(false);
  const document = useQuery7({ queryKey: [...routeKey(route), "document", documentId], queryFn: () => call(route, "document.get", { id: documentId }) });
  const write = useMutation7({
    mutationFn: ({ operation, data }) => call(route, operation, data, crypto.randomUUID()),
    onSuccess: async (saved2) => {
      await queryClient.invalidateQueries({ queryKey: routeKey(route) });
      onVersion(saved2.id);
    }
  });
  const download = useMutation7({ mutationFn: () => downloadDocument(route, documentId) });
  const saved = document.data;
  function reviseSegment(event, segment, unitIndex, segmentIndex) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    write.mutate({ operation: "document.revise_segment", data: { id: documentId, unit_index: unitIndex, segment_index: segmentIndex, segment: {
      ...segment,
      title: String(form.get("title")),
      spoken_text: String(form.get("spoken_text")),
      teacher_actions: String(form.get("teacher_actions")).split("\n").filter((line) => line.trim()),
      student_activity: String(form.get("student_activity")),
      blackboard: String(form.get("blackboard")),
      activity_minutes: Number(form.get("activity_minutes"))
    } } });
  }
  function revisePlan(event) {
    event.preventDefault();
    if (!saved) return;
    const content = structuredClone(saved.content);
    const form = new FormData(event.currentTarget);
    for (const [key] of PLAN_FIELDS) content[key] = String(form.get(key));
    content.session_number = Number(form.get("session_number"));
    content.total_lessons = String(form.get("total_lessons")) ? Number(form.get("total_lessons")) : null;
    content.activities = content.activities.map((activity, index) => ({ ...activity, teacher_activity: String(form.get(`teacher-${index}`)), student_activity: String(form.get(`student-${index}`)), methods: String(form.get(`methods-${index}`)) }));
    write.mutate({ operation: "document.save", data: { lesson_id: saved.lesson_id, kind: saved.kind, expected_version: saved.version, script_id: saved.script_id, content } });
  }
  return /* @__PURE__ */ jsxs7("article", { className: "space-y-5", "aria-label": "\u6559\u5B66\u6587\u6863\u6B63\u6587\u4E0E\u5BA1\u6838", children: [
    saved && /* @__PURE__ */ jsxs7(Fragment4, { children: [
      /* @__PURE__ */ jsxs7("h3", { className: "text-lg font-semibold", children: [
        saved.content.title,
        " \xB7 v",
        saved.version,
        " \xB7 ",
        saved.status === "approved" ? "\u6559\u5E08\u5DF2\u5BA1\u6838" : saved.status === "rejected" ? "\u5DF2\u9000\u56DE" : "\u5F85\u5BA1\u6838\u8349\u7A3F"
      ] }),
      saved.timing && /* @__PURE__ */ jsxs7("div", { "aria-label": "\u6388\u8BFE\u65F6\u95F4\u4F30\u7B97", children: [
        /* @__PURE__ */ jsxs7("p", { children: [
          "\u4E24\u5355\u5143\u4F30\u7B97\u7528\u65F6 ",
          saved.timing.estimated_units_minutes.join(" / "),
          " \u5206\u949F"
        ] }),
        /* @__PURE__ */ jsx7("p", { children: saved.timing.method }),
        saved.timing.warnings.map((warning) => /* @__PURE__ */ jsx7("p", { role: "alert", children: warning }, warning))
      ] }),
      saved.kind === "script" ? /* @__PURE__ */ jsxs7(Fragment4, { children: [
        saved.content.units.map((unit, unitIndex) => /* @__PURE__ */ jsxs7("section", { className: "space-y-4", children: [
          unitIndex === 1 && /* @__PURE__ */ jsx7("h4", { className: "font-semibold", children: "\u8BFE\u95F4\u4F11\u606F10\u5206\u949F\uFF0C\u4E0D\u8BA1\u516580\u5206\u949F\u6559\u5B66" }),
          /* @__PURE__ */ jsxs7("h4", { className: "font-semibold", children: [
            "\u7B2C",
            unitIndex + 1,
            "\u5355\u5143 ",
            unit.title,
            " \xB7 40\u5206\u949F"
          ] }),
          unit.segments.map((segment, segmentIndex) => /* @__PURE__ */ jsxs7("details", { className: "rounded border border-(--ui-border) p-3", children: [
            /* @__PURE__ */ jsxs7("summary", { children: [
              segment.title,
              " \xB7 ",
              segment.minutes,
              "\u5206\u949F"
            ] }),
            /* @__PURE__ */ jsxs7("form", { className: "mt-3 grid gap-3", onSubmit: (event) => reviseSegment(event, segment, unitIndex, segmentIndex), children: [
              /* @__PURE__ */ jsxs7("label", { children: [
                "\u73AF\u8282\u6807\u9898",
                /* @__PURE__ */ jsx7("input", { "aria-label": `\u73AF\u8282\u6807\u9898 ${unitIndex}-${segmentIndex}`, name: "title", defaultValue: segment.title, required: true })
              ] }),
              /* @__PURE__ */ jsxs7("label", { children: [
                "\u53EF\u6717\u8BFB\u6B63\u6587",
                /* @__PURE__ */ jsx7("textarea", { "aria-label": `\u53EF\u6717\u8BFB\u6B63\u6587 ${unitIndex}-${segmentIndex}`, name: "spoken_text", defaultValue: segment.spoken_text, className: "min-h-72 w-full rounded border border-(--ui-border) p-3", required: true, minLength: 200 })
              ] }),
              /* @__PURE__ */ jsxs7("label", { children: [
                "\u6559\u5E08\u52A8\u4F5C",
                /* @__PURE__ */ jsx7("textarea", { name: "teacher_actions", "aria-label": `\u6559\u5E08\u52A8\u4F5C ${unitIndex}-${segmentIndex}`, defaultValue: segment.teacher_actions.join("\n"), className: "w-full rounded border border-(--ui-border) p-2" })
              ] }),
              /* @__PURE__ */ jsxs7("label", { children: [
                "\u5B66\u751F\u6D3B\u52A8",
                /* @__PURE__ */ jsx7("textarea", { name: "student_activity", "aria-label": `\u5B66\u751F\u6D3B\u52A8 ${unitIndex}-${segmentIndex}`, defaultValue: segment.student_activity, className: "w-full rounded border border-(--ui-border) p-2" })
              ] }),
              /* @__PURE__ */ jsxs7("label", { children: [
                "\u72EC\u7ACB\u6D3B\u52A8\u5206\u949F",
                /* @__PURE__ */ jsx7("input", { "aria-label": `\u72EC\u7ACB\u6D3B\u52A8\u5206\u949F ${unitIndex}-${segmentIndex}`, name: "activity_minutes", type: "number", min: 0, max: segment.minutes - 0.1, step: "0.1", defaultValue: segment.activity_minutes })
              ] }),
              /* @__PURE__ */ jsxs7("label", { children: [
                "\u677F\u4E66",
                /* @__PURE__ */ jsx7("textarea", { name: "blackboard", "aria-label": `\u677F\u4E66 ${unitIndex}-${segmentIndex}`, defaultValue: segment.blackboard, className: "w-full rounded border border-(--ui-border) p-2" })
              ] }),
              /* @__PURE__ */ jsxs7("p", { className: "text-sm", children: [
                "\u6559\u6750\u6765\u6E90ID ",
                segment.source_ids.join("\u3001")
              ] }),
              /* @__PURE__ */ jsx7(Button7, { type: "submit", disabled: write.isPending, children: "\u4FDD\u5B58\u6B64\u73AF\u8282\u4E3A\u65B0\u7248\u672C" })
            ] })
          ] }, segmentIndex))
        ] }, unitIndex)),
        /* @__PURE__ */ jsx7("h4", { className: "font-semibold", children: "\u8BFE\u540E\u4F5C\u4E1A" }),
        /* @__PURE__ */ jsx7("ol", { children: saved.content.homework.map((item, index) => /* @__PURE__ */ jsx7("li", { children: item }, index)) })
      ] }) : /* @__PURE__ */ jsxs7("form", { onSubmit: revisePlan, className: "grid gap-4", children: [
        PLAN_FIELDS.map(([key, label]) => /* @__PURE__ */ jsxs7("label", { children: [
          label,
          /* @__PURE__ */ jsx7("textarea", { "aria-label": `\u6559\u6848${label}`, name: key, defaultValue: saved.content[key], className: "min-h-20 w-full rounded border border-(--ui-border) p-2" })
        ] }, key)),
        /* @__PURE__ */ jsxs7("label", { children: [
          "\u7B2C\u51E0\u6B21\u8BFE",
          /* @__PURE__ */ jsx7("input", { "aria-label": "\u7B2C\u51E0\u6B21\u8BFE", name: "session_number", type: "number", min: 1, required: true, defaultValue: saved.content.session_number })
        ] }),
        /* @__PURE__ */ jsxs7("label", { children: [
          "\u8BFE\u7A0B\u603B\u8BFE\u65F6",
          /* @__PURE__ */ jsx7("input", { "aria-label": "\u8BFE\u7A0B\u603B\u8BFE\u65F6", name: "total_lessons", type: "number", min: 1, defaultValue: saved.content.total_lessons ?? "" })
        ] }),
        saved.content.activities.map((activity, index) => /* @__PURE__ */ jsxs7("fieldset", { className: "space-y-2 rounded border border-(--ui-border) p-3", children: [
          /* @__PURE__ */ jsxs7("legend", { children: [
            "\u7B2C",
            activity.unit_index + 1,
            "\u5355\u5143\u7B2C",
            activity.segment_index + 1,
            "\u73AF\u8282"
          ] }),
          /* @__PURE__ */ jsxs7("label", { className: "block", children: [
            "\u6559\u5E08\u6D3B\u52A8",
            /* @__PURE__ */ jsx7("textarea", { "aria-label": `\u6559\u6848\u6559\u5E08\u6D3B\u52A8 ${index}`, name: `teacher-${index}`, defaultValue: activity.teacher_activity, className: "w-full", required: true, minLength: 20 })
          ] }),
          /* @__PURE__ */ jsxs7("label", { className: "block", children: [
            "\u5B66\u751F\u6D3B\u52A8",
            /* @__PURE__ */ jsx7("textarea", { "aria-label": `\u6559\u6848\u5B66\u751F\u6D3B\u52A8 ${index}`, name: `student-${index}`, defaultValue: activity.student_activity, className: "w-full", required: true })
          ] }),
          /* @__PURE__ */ jsxs7("label", { className: "block", children: [
            "\u6559\u5B66\u65B9\u6CD5",
            /* @__PURE__ */ jsx7("input", { "aria-label": `\u6559\u6848\u6559\u5B66\u65B9\u6CD5 ${index}`, name: `methods-${index}`, defaultValue: activity.methods, required: true })
          ] })
        ] }, index)),
        /* @__PURE__ */ jsxs7("p", { children: [
          "\u5173\u8054\u6388\u8BFE\u7A3F ",
          saved.script_id,
          " \xB7 \u6559\u5B66\u53CD\u601D\u7531\u6559\u5E08\u8BFE\u540E\u636E\u5B9E\u586B\u5199\u3002"
        ] }),
        /* @__PURE__ */ jsx7(Button7, { type: "submit", disabled: write.isPending, children: "\u4FDD\u5B58\u6559\u6848\u4FEE\u8BA2\u7248" })
      ] }),
      saved.status === "draft" && /* @__PURE__ */ jsxs7("div", { className: "space-y-3 rounded border border-(--ui-border) p-4", children: [
        /* @__PURE__ */ jsxs7("label", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx7("input", { type: "checkbox", checked: confirmed, onChange: (event) => setConfirmed(event.target.checked) }),
          "\u6211\u5DF2\u6838\u5BF9\u5B8C\u6574\u6B63\u6587\u3001\u6559\u6750\u4F9D\u636E\u548C\u65F6\u95F4\u5206\u914D"
        ] }),
        /* @__PURE__ */ jsx7(Button7, { disabled: !confirmed || write.isPending || !!saved.timing?.warnings.length, onClick: () => write.mutate({ operation: "document.review", data: { id: documentId, decision: "approved" } }), children: "\u5BA1\u6838\u901A\u8FC7\u6B64\u7248\u672C" }),
        /* @__PURE__ */ jsx7(Button7, { variant: "secondary", disabled: write.isPending, onClick: () => write.mutate({ operation: "document.review", data: { id: documentId, decision: "rejected" } }), children: "\u9000\u56DE\u6B64\u7248\u672C" })
      ] }),
      saved.status === "approved" && /* @__PURE__ */ jsx7(Button7, { disabled: download.isPending, onClick: () => download.mutate(), children: "\u4E0B\u8F7D\u6B63\u5F0FDOCX" })
    ] }),
    [document.error, write.error, download.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx7("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/preparation.tsx
import { Fragment as Fragment5, jsx as jsx8, jsxs as jsxs8 } from "react/jsx-runtime";
var STATUS2 = { pending: "\u5F85\u542F\u52A8", running: "Agent\u6267\u884C\u4E2D", awaiting_review: "\u5F85\u6559\u5E08\u5BA1\u6838", completed: "\u5DF2\u5B8C\u6210", cancelled: "\u5DF2\u53D6\u6D88", failed: "\u5931\u8D25" };
function Preparation({ route }) {
  const queryClient = useQueryClient7();
  const [courseId, setCourseId] = useState7("");
  const [lessonId, setLessonId] = useState7("");
  const [documentId, setDocumentId] = useState7("");
  const courses = useQuery8({ queryKey: [...routeKey(route), "course"], queryFn: () => call(route, "course.list") });
  const lessons = useQuery8({ queryKey: [...routeKey(route), "lessons", courseId], queryFn: () => call(route, "lesson.list", { course_id: courseId }), enabled: !!courseId });
  const documents = useQuery8({ queryKey: [...routeKey(route), "documents", lessonId], queryFn: () => call(route, "document.list", { lesson_id: lessonId }), enabled: !!lessonId });
  const generations = useQuery8({
    queryKey: [...routeKey(route), "generations", lessonId],
    queryFn: () => call(route, "document.generation.list", { lesson_id: lessonId }),
    enabled: !!lessonId,
    refetchInterval: (query) => query.state.data?.items.some((item) => item.task.status === "running") ? 3e3 : false
  });
  const generationState = generations.data?.items.map((item) => `${item.workflow_id}:${item.task.version}`).join("|") ?? "";
  useEffect(() => {
    if (lessonId) void queryClient.invalidateQueries({ queryKey: [...routeKey(route), "documents", lessonId] });
  }, [generationState, lessonId, queryClient, route]);
  const generation = useMutation8({
    mutationFn: async (kind) => {
      const task = await call(route, "document.generation.begin", { lesson_id: lessonId, kind, allow_model_call: true }, crypto.randomUUID());
      await queryClient.invalidateQueries({ queryKey: routeKey(route) });
      await openGeneration(route, task);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: routeKey(route) })
  });
  const reopen = useMutation8({ mutationFn: (task) => openGeneration(route, task) });
  const cancel = useMutation8({ mutationFn: (task) => call(route, "task.cancel", { id: task.workflow_id, version: task.task.version }, crypto.randomUUID()), onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }) });
  function start(event) {
    event.preventDefault();
    generation.mutate(String(new FormData(event.currentTarget).get("kind")));
  }
  return /* @__PURE__ */ jsxs8("section", { className: "space-y-5", "aria-label": "\u6388\u8BFE\u7A3F\u4E0E\u6559\u6848\u5907\u8BFE", children: [
    /* @__PURE__ */ jsx8("h2", { className: "text-lg font-semibold", children: "\u6388\u8BFE\u7A3F\u4E0E\u6559\u6848" }),
    /* @__PURE__ */ jsx8("p", { children: "\u8BFE\u6B21\u7ED1\u5B9A\u6559\u6750\u7248\u672C\u3002\u9010\u5B57\u7A3F\u630940\u5206\u949F\u6559\u5B66\u300110\u5206\u949F\u4F11\u606F\u300140\u5206\u949F\u6559\u5B66\u5B89\u6392\uFF0C\u6B63\u5F0F\u6210\u679C\u53EA\u5BFC\u51FADOCX\u3002" }),
    /* @__PURE__ */ jsxs8("label", { className: "grid max-w-xl gap-2", children: [
      "\u5907\u8BFE\u8BFE\u7A0B",
      /* @__PURE__ */ jsxs8("select", { "aria-label": "\u5907\u8BFE\u8BFE\u7A0B", value: courseId, onChange: (event) => {
        setCourseId(event.target.value);
        setLessonId("");
        setDocumentId("");
      }, children: [
        /* @__PURE__ */ jsx8("option", { value: "", children: "\u9009\u62E9\u8BFE\u7A0B" }),
        courses.data?.items.map((course) => /* @__PURE__ */ jsx8("option", { value: course.id, children: course.title }, course.id))
      ] })
    ] }),
    courseId && /* @__PURE__ */ jsxs8(Fragment5, { children: [
      /* @__PURE__ */ jsx8(LessonEditor, { route, courseId, onSaved: async (lesson) => {
        await queryClient.invalidateQueries({ queryKey: routeKey(route) });
        setLessonId(lesson.id);
        setDocumentId("");
      } }, courseId),
      /* @__PURE__ */ jsxs8("label", { className: "grid max-w-xl gap-2", children: [
        "\u5907\u8BFE\u8BFE\u6B21",
        /* @__PURE__ */ jsxs8("select", { "aria-label": "\u5907\u8BFE\u8BFE\u6B21", value: lessonId, onChange: (event) => {
          setLessonId(event.target.value);
          setDocumentId("");
        }, children: [
          /* @__PURE__ */ jsx8("option", { value: "", children: "\u9009\u62E9\u8BFE\u6B21" }),
          lessons.data?.items.map((lesson) => /* @__PURE__ */ jsx8("option", { value: lesson.id, children: lesson.title }, lesson.id))
        ] })
      ] })
    ] }),
    lessonId && /* @__PURE__ */ jsxs8(Fragment5, { children: [
      /* @__PURE__ */ jsxs8("form", { onSubmit: start, className: "grid max-w-xl gap-3", children: [
        /* @__PURE__ */ jsxs8("label", { children: [
          "\u751F\u6210\u6587\u6863",
          /* @__PURE__ */ jsxs8("select", { "aria-label": "\u751F\u6210\u6587\u6863\u7C7B\u578B", name: "kind", children: [
            /* @__PURE__ */ jsx8("option", { value: "script", children: "\u5B8C\u6574\u6388\u8BFE\u9010\u5B57\u7A3F" }),
            /* @__PURE__ */ jsx8("option", { value: "lesson_plan", children: "\u539F\u6A21\u677F\u6B63\u5F0F\u6559\u6848" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs8("label", { className: "flex items-start gap-2", children: [
          /* @__PURE__ */ jsx8("input", { type: "checkbox", required: true }),
          "\u5141\u8BB8\u672C\u6B21\u8C03\u7528Hermes Agent\u751F\u6210\u6587\u6863\uFF0C\u4F7F\u7528\u9636\u6BB5\u914D\u7F6E\u6A21\u578B\u6216\u5F53\u524D\u6A21\u578B\uFF0C\u53EF\u80FD\u4EA7\u751FAPI\u8D39\u7528"
        ] }),
        /* @__PURE__ */ jsx8(Button8, { type: "submit", disabled: generation.isPending, children: "\u8C03\u7528\u539F\u751FAgent\u751F\u6210\u8349\u7A3F" })
      ] }),
      generations.data?.items.map((task) => /* @__PURE__ */ jsxs8("article", { className: "space-y-2 rounded border border-(--ui-border) p-3", children: [
        /* @__PURE__ */ jsxs8("p", { children: [
          task.task.input.title,
          " \xB7 ",
          STATUS2[task.task.status] ?? task.task.status,
          " \xB7 ",
          task.workflow_id
        ] }),
        /* @__PURE__ */ jsx8(Button8, { disabled: reopen.isPending, onClick: () => reopen.mutate(task), children: task.task.status === "pending" ? "\u542F\u52A8\u5DF2\u4FDD\u5B58\u4EFB\u52A1" : "\u6253\u5F00\u539FAgent\u4F1A\u8BDD" }),
        ["pending", "running", "awaiting_review"].includes(task.task.status) && /* @__PURE__ */ jsx8(Button8, { variant: "secondary", onClick: () => cancel.mutate(task), disabled: cancel.isPending, children: "\u53D6\u6D88\u8349\u7A3F\u4FDD\u5B58\u4EFB\u52A1" }),
        task.task.status === "running" && /* @__PURE__ */ jsx8("p", { children: "\u5982\u9700\u505C\u6B62\u6A21\u578B\u8C03\u7528\uFF0C\u8BF7\u6253\u5F00\u539FAgent\u4F1A\u8BDD\u4F7F\u7528\u505C\u6B62\u6309\u94AE\u3002\u4EFB\u52A1\u63D0\u4EA4\u72B6\u6001\u4E0D\u786E\u5B9A\u65F6\uFF0C\u5148\u6838\u67E5\u539F\u4F1A\u8BDD\u3002" })
      ] }, task.workflow_id)),
      /* @__PURE__ */ jsxs8("label", { className: "grid max-w-xl gap-2", children: [
        "\u6559\u5B66\u6587\u6863\u7248\u672C",
        /* @__PURE__ */ jsxs8("select", { "aria-label": "\u6559\u5B66\u6587\u6863\u7248\u672C", value: documentId, onChange: (event) => setDocumentId(event.target.value), children: [
          /* @__PURE__ */ jsx8("option", { value: "", children: "\u9009\u62E9\u6587\u6863\u7248\u672C" }),
          documents.data?.items.map((document) => /* @__PURE__ */ jsxs8("option", { value: document.id, children: [
            document.kind === "script" ? "\u6388\u8BFE\u7A3F" : "\u6559\u6848",
            " \xB7 v",
            document.version,
            " \xB7 ",
            document.status === "approved" ? "\u5DF2\u5BA1\u6838" : document.status === "rejected" ? "\u5DF2\u9000\u56DE" : "\u8349\u7A3F"
          ] }, document.id))
        ] })
      ] }),
      /* @__PURE__ */ jsx8(Button8, { variant: "secondary", onClick: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }), children: "\u5237\u65B0\u5907\u8BFE\u8BB0\u5F55" }),
      documents.data?.items.length === 0 && /* @__PURE__ */ jsx8("p", { children: "\u5C1A\u672A\u4FDD\u5B58\u6559\u5B66\u6B63\u6587\u3002Agent\u4FDD\u5B58\u540E\u91CD\u65B0\u8FDB\u5165\u672C\u9875\u9762\u5373\u53EF\u8BFB\u53D6\u3002" }),
      documentId && /* @__PURE__ */ jsx8(DocumentEditor, { route, documentId, onVersion: setDocumentId }, documentId)
    ] }),
    [courses.error, lessons.error, documents.error, generations.error, generation.error, reopen.error, cancel.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx8("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/plugin.tsx
import { jsx as jsx9, jsxs as jsxs9 } from "react/jsx-runtime";
var PAGES = [
  ["course", "\u6211\u7684\u8BFE\u7A0B"],
  ["class", "\u73ED\u7EA7"],
  ["student", "\u5B66\u751F\u6863\u6848"],
  ["roster", "\u8BFE\u7A0B\u8EAB\u4EFD\u5173\u8054"],
  ["textbooks", "\u6559\u6750\u77E5\u8BC6\u5E93"],
  ["preparation", "\u6388\u8BFE\u7A3F\u4E0E\u6559\u6848"],
  ["tasks", "\u4EFB\u52A1\u4E0E\u5BA1\u6279"],
  ["settings", "\u6A21\u578B\u4E0E\u6743\u9650"]
];
function TeacherWorkspace() {
  const profile = useValue(host3.state.profile);
  const connectionId = useValue(host3.state.connectionId);
  const [page, setPage] = useState8("course");
  const routing = useQuery9({
    queryKey: ["teacher-route", connectionId, profile],
    queryFn: async () => {
      const routes = await host3.profileRoutes();
      const route2 = routes.find((item) => item.connectionId === connectionId && item.profile === profile);
      if (!route2) throw new Error("\u5F53\u524D\u6559\u5E08\u914D\u7F6E\u7684 Gateway \u8DEF\u7531\u5C1A\u672A\u5C31\u7EEA");
      return route2;
    }
  });
  const route = routing.data;
  return /* @__PURE__ */ jsxs9("main", { className: "h-full overflow-auto p-6 text-(--ui-text-primary)", "aria-label": "\u6559\u5E08\u4E13\u4E1A\u5DE5\u4F5C\u53F0", children: [
    /* @__PURE__ */ jsxs9("header", { className: "mb-6 space-y-2", children: [
      /* @__PURE__ */ jsx9("h1", { className: "text-2xl font-semibold", children: "\u6559\u5E08\u4E13\u4E1A\u5DE5\u4F5C\u53F0" }),
      /* @__PURE__ */ jsxs9("p", { children: [
        "\u5F53\u524D\u914D\u7F6E \xB7 ",
        profile,
        " \xB7 \u672C\u5730\u6559\u5B66\u6570\u636E\u4E0E Hermes \u4F1A\u8BDD\u5206\u5F00\u4FDD\u5B58"
      ] })
    ] }),
    /* @__PURE__ */ jsx9("nav", { className: "mb-6 flex flex-wrap gap-2", "aria-label": "\u6559\u5E08\u4E1A\u52A1\u5BFC\u822A", children: PAGES.map(([key, label]) => /* @__PURE__ */ jsx9(Button9, { variant: page === key ? "secondary" : "ghost", onClick: () => setPage(key), children: label }, key)) }),
    routing.isPending && /* @__PURE__ */ jsx9("p", { role: "status", children: "\u6B63\u5728\u8FDE\u63A5\u6559\u5E08\u914D\u7F6E\u2026" }),
    routing.error && /* @__PURE__ */ jsx9("p", { role: "alert", children: routing.error.message }),
    route && /* @__PURE__ */ jsxs9("div", { children: [
      ["course", "class", "student"].includes(page) && /* @__PURE__ */ jsx9(RecordEditor, { route, entity: page }),
      page === "roster" && /* @__PURE__ */ jsx9(CourseRoster, { route }),
      page === "tasks" && /* @__PURE__ */ jsx9(Tasks, { route }),
      page === "textbooks" && /* @__PURE__ */ jsx9(Textbooks, { route }),
      page === "preparation" && /* @__PURE__ */ jsx9(Preparation, { route }),
      page === "settings" && /* @__PURE__ */ jsx9(Settings, { route })
    ] }, `${route.connectionId}:${route.profile}:${route.targetProfile}:${page}`)
  ] });
}
var plugin_default = {
  id: "teacher-assistant",
  name: "\u6559\u5E08\u4E13\u4E1A\u5DE5\u4F5C\u53F0",
  register(ctx) {
    ctx.registerMany([
      { id: "workspace", area: ROUTES_AREA, data: { path: "/teacher" }, render: () => /* @__PURE__ */ jsx9(TeacherWorkspace, {}) },
      { id: "navigation", area: SIDEBAR_NAV_AREA, data: { path: "/teacher", label: "\u6559\u5E08\u5DE5\u4F5C\u53F0", codicon: "mortar-board" } }
    ]);
  }
};
export {
  plugin_default as default
};
