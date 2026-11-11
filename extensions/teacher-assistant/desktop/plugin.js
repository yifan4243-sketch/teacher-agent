// Generated from desktop/src by scripts/build_desktop.mjs.

// extensions/teacher-assistant/desktop/src/plugin.tsx
import { Button as Button17, host as host6, ROUTES_AREA, SIDEBAR_NAV_AREA, useQuery as useQuery17, useValue } from "@hermes/plugin-sdk";
import { useState as useState16 } from "react";

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
        task.kind === "document_generation" && /* @__PURE__ */ jsx3("p", { children: "\u8BF7\u5728\u201C\u6388\u8BFE\u7A3F\u4E0E\u6559\u6848\u201D\u6216\u201C\u8BFE\u4EF6\u9875\u9762\u84DD\u56FE\u201D\u67E5\u770B\u5BF9\u5E94\u7684Agent\u4F1A\u8BDD\u4E0E\u5BA1\u6838\u7248\u672C\u3002" }),
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
      toolsets: ["teacher", "skills"],
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
  if (saved?.kind === "slide_blueprint") return /* @__PURE__ */ jsx7("p", { children: "\u8BF7\u5728\u8BFE\u4EF6\u9875\u9762\u84DD\u56FE\u4E2D\u5FC3\u67E5\u770B\u4E0E\u5BA1\u6838\u8BE5\u7248\u672C\u3002" });
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
      generations.data?.items.filter((task) => task.kind !== "slide_blueprint").map((task) => /* @__PURE__ */ jsxs8("article", { className: "space-y-2 rounded border border-(--ui-border) p-3", children: [
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
          documents.data?.items.filter((document) => document.kind !== "slide_blueprint").map((document) => /* @__PURE__ */ jsxs8("option", { value: document.id, children: [
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

// extensions/teacher-assistant/desktop/src/slides-workspace.tsx
import { Button as Button16, useMutation as useMutation16, useQuery as useQuery16, useQueryClient as useQueryClient15 } from "@hermes/plugin-sdk";
import { useEffect as useEffect2, useState as useState15 } from "react";

// extensions/teacher-assistant/desktop/src/blueprint-editor.tsx
import { Button as Button15, useMutation as useMutation15, useQuery as useQuery15, useQueryClient as useQueryClient14 } from "@hermes/plugin-sdk";
import { useState as useState14 } from "react";

// extensions/teacher-assistant/desktop/src/slide-images.tsx
import { Button as Button11, useMutation as useMutation11, useQuery as useQuery11, useQueryClient as useQueryClient10 } from "@hermes/plugin-sdk";
import { useState as useState10 } from "react";

// extensions/teacher-assistant/desktop/src/slide-references.tsx
import { Button as Button9, useMutation as useMutation9, useQuery as useQuery9, useQueryClient as useQueryClient8 } from "@hermes/plugin-sdk";
import { useState as useState8 } from "react";
import { jsx as jsx9, jsxs as jsxs9 } from "react/jsx-runtime";
function SlideReferences({ route, blueprintId, selected, onSelect }) {
  const queryClient = useQueryClient8();
  const [offset, setOffset] = useState8(0);
  const key = [...routeKey(route), "slide-references", blueprintId];
  const references = useQuery9({ queryKey: [...key, offset], queryFn: () => call(route, "slide.reference.list", { blueprint_id: blueprintId, offset, limit: 20 }) });
  const preview = useQuery9({ queryKey: [...key, "preview", selected], queryFn: () => call(route, "slide.reference.preview", { id: selected }), enabled: !!selected });
  const upload = useMutation9({
    mutationFn: async ({ file, label, note }) => {
      if (!file.size || file.size > 2 * 1024 * 1024) throw new Error("\u53C2\u8003\u56FE\u5927\u5C0F\u9700\u5927\u4E8E0\u4E14\u4E0D\u8D85\u8FC72MB");
      const bytes = await file.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (value) => value.toString(16).padStart(2, "0")).join("");
      const encoded = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("\u65E0\u6CD5\u8BFB\u53D6\u6240\u9009\u53C2\u8003\u56FE"));
        reader.readAsDataURL(file);
      });
      return call(route, "slide.reference.upload", { blueprint_id: blueprintId, label, source_note: note, content_base64: encoded, sha256: digest }, crypto.randomUUID());
    },
    onSuccess: async (reference) => {
      await queryClient.invalidateQueries({ queryKey: key });
      onSelect(reference.id);
    }
  });
  const archive = useMutation9({
    mutationFn: () => call(route, "slide.reference.archive", { id: selected }, crypto.randomUUID()),
    onSuccess: async () => {
      onSelect("");
      await queryClient.invalidateQueries({ queryKey: key });
    }
  });
  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (file instanceof File) upload.mutate({ file, label: String(form.get("label")), note: String(form.get("note")) });
  }
  return /* @__PURE__ */ jsxs9("section", { "aria-label": "\u53EF\u9009\u53C2\u8003\u7D20\u6750", className: "space-y-3", children: [
    /* @__PURE__ */ jsx9("h4", { children: "\u53EF\u9009\u53C2\u8003\u7D20\u6750" }),
    /* @__PURE__ */ jsx9("p", { children: "\u4E0D\u9009\u62E9\u7D20\u6750\u65F6\u7CFB\u7EDF\u81EA\u52A8\u8BBE\u8BA1\u3002\u4E0A\u4F20\u4EC5\u4FDD\u5B58\u5728\u672C\u5730\uFF1B\u9884\u7559\u751F\u56FE\u4EFB\u52A1\u65F6\uFF0C\u9700\u53E6\u884C\u6388\u6743\u53D1\u9001\u6240\u9009\u56FE\u7247\u3002\u5F52\u6863\u4E0D\u5220\u9664\u5386\u53F2\u7D20\u6750\u6216\u64A4\u9500\u5DF2\u6388\u6743\u4EFB\u52A1\u3002" }),
    /* @__PURE__ */ jsxs9("form", { onSubmit: submit, className: "grid max-w-3xl gap-2", children: [
      /* @__PURE__ */ jsxs9("label", { children: [
        "\u53C2\u8003\u7D20\u6750\u540D\u79F0",
        /* @__PURE__ */ jsx9("input", { name: "label", "aria-label": "\u53C2\u8003\u7D20\u6750\u540D\u79F0", maxLength: 120, required: true })
      ] }),
      /* @__PURE__ */ jsxs9("label", { children: [
        "\u53C2\u8003\u7D20\u6750\u6765\u6E90\u8BF4\u660E",
        /* @__PURE__ */ jsx9("input", { name: "note", "aria-label": "\u53C2\u8003\u7D20\u6750\u6765\u6E90\u8BF4\u660E", maxLength: 1e3 })
      ] }),
      /* @__PURE__ */ jsxs9("label", { children: [
        "\u53C2\u8003\u56FE\u7247\uFF08\u6700\u59272MB\uFF09",
        /* @__PURE__ */ jsx9("input", { name: "file", "aria-label": "\u53C2\u8003\u56FE\u7247", type: "file", accept: "image/png,image/jpeg,image/webp", required: true })
      ] }),
      /* @__PURE__ */ jsx9(Button9, { type: "submit", disabled: upload.isPending, children: "\u4FDD\u5B58\u53C2\u8003\u7D20\u6750\u5230\u672C\u5730" })
    ] }),
    /* @__PURE__ */ jsxs9("label", { children: [
      "\u672C\u6B21\u751F\u56FE\u53C2\u8003",
      /* @__PURE__ */ jsxs9("select", { "aria-label": "\u672C\u6B21\u751F\u56FE\u53C2\u8003", value: selected, onChange: (event) => onSelect(event.target.value), children: [
        /* @__PURE__ */ jsx9("option", { value: "", children: "\u81EA\u52A8\u8BBE\u8BA1\uFF0C\u4E0D\u4F7F\u7528\u53C2\u8003\u56FE" }),
        references.data?.items.map((reference) => /* @__PURE__ */ jsxs9("option", { value: reference.id, disabled: !!reference.archived, children: [
          reference.label,
          " \xB7 ",
          reference.width,
          "\xD7",
          reference.height,
          reference.archived ? " \xB7 \u5DF2\u5F52\u6863" : ""
        ] }, reference.id)),
        selected && !references.data?.items.some((reference) => reference.id === selected) && /* @__PURE__ */ jsx9("option", { value: selected, children: "\u5F53\u524D\u5DF2\u9009\u7D20\u6750" })
      ] })
    ] }),
    selected && preview.data && /* @__PURE__ */ jsx9("img", { alt: "\u53EF\u9009\u53C2\u8003\u56FE\u7247\u9884\u89C8", className: "max-w-lg rounded", src: `data:${preview.data.mime_type};base64,${preview.data.content_base64}` }),
    /* @__PURE__ */ jsxs9("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx9(Button9, { variant: "secondary", disabled: !selected || archive.isPending, onClick: () => archive.mutate(), children: "\u5F52\u6863\u6240\u9009\u53C2\u8003\u7D20\u6750" }),
      /* @__PURE__ */ jsx9(Button9, { variant: "secondary", disabled: offset === 0, onClick: () => setOffset(Math.max(0, offset - 20)), children: "\u4E0A\u4E00\u7EC4\u53C2\u8003\u7D20\u6750" }),
      /* @__PURE__ */ jsx9(Button9, { variant: "secondary", disabled: references.data?.next_offset == null, onClick: () => setOffset(references.data?.next_offset ?? offset), children: "\u4E0B\u4E00\u7EC4\u53C2\u8003\u7D20\u6750" })
    ] }),
    [references.error, preview.error, upload.error, archive.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx9("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/image-api.ts
import { captureGatewayFileDownload as captureGatewayFileDownload2, host as host3 } from "@hermes/plugin-sdk";
function usd(micro) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "USD", maximumFractionDigits: 6 }).format(micro / 1e6);
}
async function runImage(route, job) {
  const release = await host3.retainProfile(route, { spawnPriority: "foreground" });
  try {
    const result = await host3.requestProfile(route, "plugin.teacher-assistant.call", {
      operation: "slide.image.run",
      data: { id: job.id },
      request_id: job.id
    }, 6e5);
    if (!result.ok) throw new Error(result.error?.message ?? "\u56FE\u7247\u4EFB\u52A1\u6267\u884C\u5931\u8D25");
    return result.data;
  } finally {
    release();
  }
}
async function downloadImage(route, assetId) {
  const save = captureGatewayFileDownload2();
  const file = await call(route, "slide.image.file", { id: assetId });
  await save(file.stored_path, file.filename);
}
async function runQueuedImages(route, blueprintId, onUpdate) {
  const queued = [];
  let offset = 0;
  while (offset !== null) {
    const group = await call(route, "slide.image.list", { blueprint_id: blueprintId, offset, limit: 100 });
    queued.push(...group.items.filter((job) => job.state === "queued"));
    offset = group.next_offset;
  }
  for (const job of queued) {
    const result = await runImage(route, job);
    await onUpdate();
    if (result.state === "failed" || result.state === "running") throw new Error("\u6279\u6B21\u5DF2\u505C\u6B62\uFF0C\u8BF7\u6838\u5BF9\u539F\u4EFB\u52A1\u72B6\u6001\u548C\u8D39\u7528\u540E\u7EE7\u7EED");
  }
}

// extensions/teacher-assistant/desktop/src/slide-image-preview.tsx
import { Button as Button10, useMutation as useMutation10, useQuery as useQuery10, useQueryClient as useQueryClient9 } from "@hermes/plugin-sdk";
import { useState as useState9 } from "react";
import { jsx as jsx10, jsxs as jsxs10 } from "react/jsx-runtime";
function SlideImagePreview({ route, asset, selected }) {
  const queryClient = useQueryClient9();
  const [expanded, setExpanded] = useState9(false);
  const preview = useQuery10({
    queryKey: [...routeKey(route), "image-preview", asset.id],
    queryFn: () => call(route, "slide.image.preview", { id: asset.id }),
    enabled: expanded,
    staleTime: Infinity
  });
  const download = useMutation10({ mutationFn: () => downloadImage(route, asset.id) });
  const review = useMutation10({
    mutationFn: (data) => call(route, "slide.image.review", data, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...routeKey(route), "images"] })
  });
  function submitReview(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    review.mutate({ id: asset.id, expected_version: asset.review_version, decision: form.get("decision"), note: form.get("note") });
  }
  const statuses = { needs_text_review: "\u5F85\u6838\u5BF9\u6587\u5B57\u548C\u56FE\u89E3", approved: "\u6559\u5E08\u5DF2\u901A\u8FC7", rejected: "\u6559\u5E08\u5DF2\u9000\u56DE", aspect_ratio_mismatch: "\u539F\u56FE\u6BD4\u4F8B\u9700\u89C4\u8303\u5316" };
  return /* @__PURE__ */ jsxs10("div", { className: "space-y-3 rounded border border-(--ui-border) p-3", children: [
    /* @__PURE__ */ jsxs10("p", { children: [
      asset.source_asset_id ? "16\u22369\u7B49\u6BD4\u7559\u8FB9\u7248\u672C" : "\u6A21\u578B\u9AD8\u6E05\u539F\u56FE",
      " \xB7 ",
      asset.width,
      "\xD7",
      asset.height,
      " \xB7 ",
      statuses[asset.verification_status] ?? asset.verification_status,
      selected ? " \xB7 \u5F53\u524D\u7ED3\u679C" : ""
    ] }),
    /* @__PURE__ */ jsxs10("p", { className: "break-all text-sm", children: [
      "SHA-256 ",
      asset.sha256
    ] }),
    asset.source_asset_id && /* @__PURE__ */ jsxs10("p", { children: [
      "\u539F\u59CB\u50CF\u7D20\u5B8C\u6574\u4FDD\u7559\uFF0C\u53E6\u5B58\u7559\u8FB9\u7248\u672C\u3002\u5904\u7406\u8BB0\u5F55 ",
      asset.processing_json
    ] }),
    /* @__PURE__ */ jsxs10("div", { className: "flex flex-wrap gap-2", children: [
      /* @__PURE__ */ jsx10(Button10, { variant: "secondary", onClick: () => setExpanded((value) => !value), children: expanded ? "\u6536\u8D77\u8BBE\u8BA1\u56FE" : "\u9884\u89C8\u8BBE\u8BA1\u56FE" }),
      /* @__PURE__ */ jsx10(Button10, { variant: "secondary", disabled: download.isPending, onClick: () => download.mutate(), children: "\u4E0B\u8F7D\u9AD8\u6E05\u56FE\u7247" })
    ] }),
    expanded && preview.isPending && /* @__PURE__ */ jsx10("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u8BBE\u8BA1\u56FE" }),
    expanded && preview.data && /* @__PURE__ */ jsx10("img", { alt: "\u6559\u5B66\u9875\u9762\u8BBE\u8BA1\u9884\u89C8", className: "w-full rounded", src: `data:${preview.data.mime_type};base64,${preview.data.content_base64}` }),
    selected && /* @__PURE__ */ jsxs10("form", { onSubmit: submitReview, className: "grid gap-2", children: [
      /* @__PURE__ */ jsxs10("label", { children: [
        "\u56FE\u7247\u6838\u5BF9\u7ED3\u8BBA",
        /* @__PURE__ */ jsxs10("select", { name: "decision", "aria-label": "\u56FE\u7247\u6838\u5BF9\u7ED3\u8BBA", defaultValue: "approved", children: [
          /* @__PURE__ */ jsx10("option", { value: "approved", children: "\u901A\u8FC7" }),
          /* @__PURE__ */ jsx10("option", { value: "rejected", children: "\u9000\u56DE\u91CD\u505A" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs10("label", { children: [
        "\u56FE\u7247\u6838\u5BF9\u610F\u89C1",
        /* @__PURE__ */ jsx10("input", { name: "note", "aria-label": "\u56FE\u7247\u6838\u5BF9\u610F\u89C1", maxLength: 2e3, required: true })
      ] }),
      /* @__PURE__ */ jsxs10("label", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx10("input", { type: "checkbox", required: true }),
        "\u5DF2\u9010\u5B57\u6838\u5BF9\u84DD\u56FE\u6587\u5B57\u3001\u6559\u6750\u4F9D\u636E\u3001\u56FE\u89E3\u5173\u7CFB\u548C\u6295\u5F71\u53EF\u8BFB\u6027"
      ] }),
      /* @__PURE__ */ jsx10(Button10, { type: "submit", disabled: review.isPending, children: "\u4FDD\u5B58\u56FE\u7247\u6838\u5BF9\u7ED3\u8BBA" })
    ] }),
    [preview.error, download.error, review.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx10("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/slide-images.tsx
import { Fragment as Fragment6, jsx as jsx11, jsxs as jsxs11 } from "react/jsx-runtime";
function SlideImages({ route, blueprint }) {
  const [referenceId, setReferenceId] = useState10("");
  const queryClient = useQueryClient10();
  const [pageNumber, setPageNumber] = useState10(blueprint.content.pages[0].number);
  const [offset, setOffset] = useState10(0);
  const [costAcknowledged, setCostAcknowledged] = useState10(false);
  const key = [...routeKey(route), "images", blueprint.id];
  const budget = useQuery11({ queryKey: [...key, "budget"], queryFn: () => call(route, "slide.image.budget", { blueprint_id: blueprint.id }), refetchInterval: 3e3 });
  const jobs = useQuery11({
    queryKey: [...key, "jobs", offset],
    queryFn: () => call(route, "slide.image.list", { blueprint_id: blueprint.id, offset }),
    refetchInterval: 3e3
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const setBudget = useMutation11({ mutationFn: (micro) => call(route, "slide.image.set_budget", { blueprint_id: blueprint.id, budget_micro_usd: micro }, crypto.randomUUID()), onSettled: refresh });
  const reserve = useMutation11({
    mutationFn: async ({ pages, estimate, allowed, force, allowReference }) => {
      for (const number of pages) {
        await call(route, referenceId ? "slide.image.reserve_references" : "slide.image.reserve", {
          id: blueprint.id,
          page_number: number,
          estimated_micro_usd: estimate,
          allow_model_call: allowed,
          force_regenerate: force,
          ...referenceId ? { reference_id: referenceId, allow_reference_upload: allowReference } : {}
        }, crypto.randomUUID());
        await refresh();
      }
    },
    onSettled: refresh
  });
  const execute = useMutation11({ mutationFn: (job) => runImage(route, job), retry: false, onSettled: refresh });
  const executeBatch = useMutation11({ mutationFn: () => runQueuedImages(route, blueprint.id, refresh), retry: false, onSettled: refresh });
  const analyze = useMutation11({
    mutationFn: ({ assetId, estimate, force }) => call(route, "slide.image.reserve_analysis", {
      id: assetId,
      estimated_micro_usd: estimate,
      allow_model_call: true,
      force_regenerate: force
    }, crypto.randomUUID()),
    onSettled: refresh
  });
  const cancel = useMutation11({ mutationFn: (job) => call(route, "slide.image.abandon", { id: job.id, acknowledge_possible_cost: costAcknowledged }, crypto.randomUUID()), onSettled: refresh });
  function saveBudget(event) {
    event.preventDefault();
    setBudget.mutate(Math.round(Number(new FormData(event.currentTarget).get("budget")) * 1e6));
  }
  function reservePages(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pages = form.get("scope") === "all" ? blueprint.content.pages.map((page) => page.number) : [pageNumber];
    reserve.mutate({ pages, estimate: Math.round(Number(form.get("estimate")) * 1e6), allowed: form.has("allow"), force: form.has("force"), allowReference: form.has("allow-reference") });
  }
  function reserveAnalysis(event, assetId) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    analyze.mutate({ assetId, estimate: Math.round(Number(form.get("analysis-estimate")) * 1e6), force: form.has("analysis-force") });
  }
  const states = { queued: "\u5F85\u6267\u884C", running: "\u6267\u884C\u4E2D\uFF0C\u52FF\u91CD\u590D\u8C03\u7528", succeeded: "\u5DF2\u751F\u6210", failed: "\u5931\u8D25", cancelled: "\u5DF2\u53D6\u6D88", cached: "\u590D\u7528\u7F13\u5B58" };
  const errors = {
    reference_not_supported: "\u5F53\u524D\u751F\u56FE\u6A21\u578B\u672A\u58F0\u660E\u652F\u6301\u53C2\u8003\u56FE\u7247\uFF0C\u8BF7\u5207\u6362\u652F\u6301\u7684\u6A21\u578B\u6216\u53D6\u6D88\u53C2\u8003\u7D20\u6750\u540E\u91CD\u65B0\u9884\u7559\u4EFB\u52A1",
    file_integrity_error: "\u4EFB\u52A1\u6240\u9700\u6587\u4EF6\u672A\u901A\u8FC7\u54C8\u5E0C\u6821\u9A8C\uFF0C\u8BF7\u6838\u5BF9\u672C\u5730\u7D20\u6750",
    image_configuration_changed: "\u751F\u56FE\u914D\u7F6E\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u9884\u7559\u56FE\u7247\u4EFB\u52A1"
  };
  return /* @__PURE__ */ jsxs11("section", { className: "space-y-4", "aria-label": "AI\u9010\u9875\u8BBE\u8BA1\u56FE\u7247", children: [
    /* @__PURE__ */ jsx11("h3", { className: "text-lg font-semibold", children: "AI\u9010\u9875\u8BBE\u8BA1\u56FE\u7247" }),
    /* @__PURE__ */ jsx11("p", { children: "\u5DF2\u5BA1\u6838\u84DD\u56FE \u2192 \u81EA\u52A8\u5408\u6210\u63D0\u793A\u8BCD \u2192 Hermes\u539F\u751F\u751F\u56FE\u670D\u52A1\u3002\u6BCF\u6B21\u5916\u90E8\u8C03\u7528\u524D\u5148\u9884\u7559\u8D39\u7528\u3002" }),
    /* @__PURE__ */ jsx11(SlideReferences, { route, blueprintId: blueprint.id, selected: referenceId, onSelect: setReferenceId }),
    budget.data && /* @__PURE__ */ jsxs11(Fragment6, { children: [
      /* @__PURE__ */ jsxs11("p", { role: "status", children: [
        "\u9884\u7B97 ",
        usd(budget.data.budget_micro_usd),
        " \xB7 \u5F85\u6267\u884C\u9884\u7559 ",
        usd(budget.data.reserved_micro_usd),
        " \xB7 \u5DF2\u8BB0\u5F55 ",
        usd(budget.data.spent_micro_usd)
      ] }),
      /* @__PURE__ */ jsx11("p", { children: budget.data.cost_basis }),
      /* @__PURE__ */ jsxs11("form", { onSubmit: saveBudget, className: "flex flex-wrap items-end gap-2", children: [
        /* @__PURE__ */ jsxs11("label", { children: [
          "\u672C\u84DD\u56FE\u9884\u7B97\uFF08\u7F8E\u5143\uFF09",
          /* @__PURE__ */ jsx11("input", { "aria-label": "\u672C\u84DD\u56FE\u9884\u7B97\uFF08\u7F8E\u5143\uFF09", name: "budget", type: "number", min: "0", max: "1000000", step: "0.000001", defaultValue: budget.data.budget_micro_usd / 1e6, required: true })
        ] }),
        /* @__PURE__ */ jsx11(Button11, { type: "submit", disabled: setBudget.isPending, children: "\u4FDD\u5B58\u56FE\u7247\u4EFB\u52A1\u9884\u7B97" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs11("form", { onSubmit: reservePages, className: "grid max-w-3xl gap-3", children: [
      /* @__PURE__ */ jsxs11("label", { children: [
        "\u56FE\u7247\u9875\u7801",
        /* @__PURE__ */ jsx11("select", { "aria-label": "\u56FE\u7247\u9875\u7801", value: pageNumber, onChange: (event) => setPageNumber(Number(event.target.value)), children: blueprint.content.pages.map((page) => /* @__PURE__ */ jsxs11("option", { value: page.number, children: [
          "\u7B2C",
          page.number,
          "\u9875 ",
          page.title
        ] }, page.number)) })
      ] }),
      /* @__PURE__ */ jsxs11("label", { children: [
        "\u9884\u7559\u8303\u56F4",
        /* @__PURE__ */ jsxs11("select", { name: "scope", "aria-label": "\u56FE\u7247\u9884\u7559\u8303\u56F4", children: [
          /* @__PURE__ */ jsx11("option", { value: "single", children: "\u5F53\u524D\u9875" }),
          /* @__PURE__ */ jsx11("option", { value: "all", children: "\u5168\u90E8\u9875\u9762\uFF0C\u4F9D\u9875\u5E8F\u9884\u7559" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs11("label", { children: [
        "\u5355\u9875\u4F30\u7B97\u8D39\u7528\uFF08\u7F8E\u5143\uFF09",
        /* @__PURE__ */ jsx11("input", { name: "estimate", "aria-label": "\u5355\u9875\u4F30\u7B97\u8D39\u7528\uFF08\u7F8E\u5143\uFF09", type: "number", min: "0.000001", max: "1000", step: "0.000001", required: true })
      ] }),
      /* @__PURE__ */ jsxs11("label", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx11("input", { type: "checkbox", name: "allow" }),
        "\u6388\u6743\u6240\u9009\u9875\u9762\u8C03\u7528\u5F53\u524D\u914D\u7F6E\u7684\u751F\u56FE\u670D\u52A1\u5E76\u63A5\u53D7\u4F30\u7B97\u8D39\u7528\uFF0C\u5B9E\u9645\u8D26\u5355\u4EE5\u670D\u52A1\u5546\u4E3A\u51C6"
      ] }),
      referenceId && /* @__PURE__ */ jsxs11("label", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx11("input", { type: "checkbox", name: "allow-reference", required: true }),
        "\u6388\u6743\u5C06\u672C\u6B21\u9009\u5B9A\u7684\u53C2\u8003\u56FE\u7247\u53D1\u9001\u7ED9\u5F53\u524D\u751F\u56FE\u670D\u52A1\uFF0C\u4EC5\u7528\u4E8E\u89C6\u89C9\u98CE\u683C"
      ] }),
      /* @__PURE__ */ jsxs11("label", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx11("input", { type: "checkbox", name: "force" }),
        "\u91CD\u65B0\u751F\u6210\u6240\u9009\u9875\u9762\u5E76\u53E6\u8BA1\u8D39\u7528\uFF0C\u4FDD\u7559\u5386\u53F2\u56FE\u7247"
      ] }),
      /* @__PURE__ */ jsx11(Button11, { type: "submit", disabled: reserve.isPending, children: "\u9884\u7559\u6240\u9009\u56FE\u7247\u4EFB\u52A1" })
    ] }),
    /* @__PURE__ */ jsx11("p", { children: "\u5DF2\u6709\u7F13\u5B58\u65F6\u53EF\u76F4\u63A5\u590D\u7528\u3002\u4EFB\u52A1\u6267\u884C\u671F\u95F4\u53EF\u5207\u6362\u9875\u9762\uFF0C\u5237\u65B0\u540E\u53EF\u67E5\u8BE2\u6301\u4E45\u72B6\u6001\u3002\u8FDE\u63A5\u8D85\u65F6\u540E\u8BF7\u5148\u67E5\u8BE2\u539F\u4EFB\u52A1\u3002" }),
    /* @__PURE__ */ jsxs11("label", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx11("input", { type: "checkbox", checked: costAcknowledged, onChange: (event) => setCostAcknowledged(event.target.checked) }),
      "\u786E\u8BA4\u8FD0\u884C\u4E2D\u7684\u8BF7\u6C42\u53EF\u80FD\u5DF2\u8BA1\u8D39\uFF0C\u53D6\u6D88\u5C06\u505C\u6B62\u91C7\u7EB3\u7ED3\u679C\uFF0C\u8FDF\u5230\u56FE\u7247\u4FDD\u7559\u5728\u5386\u53F2\u8BB0\u5F55"
    ] }),
    /* @__PURE__ */ jsx11(Button11, { variant: "secondary", onClick: () => void refresh(), children: "\u5237\u65B0\u56FE\u7247\u4EFB\u52A1" }),
    /* @__PURE__ */ jsx11(Button11, { disabled: execute.isPending || executeBatch.isPending || !jobs.data?.total, onClick: () => executeBatch.mutate(), children: "\u4F9D\u6B21\u6267\u884C\u5DF2\u9884\u7559\u7684\u5F85\u6267\u884C\u4EFB\u52A1" }),
    jobs.data?.items.map((job) => /* @__PURE__ */ jsxs11("article", { "aria-label": `\u7B2C${job.page_number}\u9875\u56FE\u7247\u4EFB\u52A1 ${job.id}`, className: "space-y-3 rounded border border-(--ui-border) p-4", children: [
      /* @__PURE__ */ jsxs11("h4", { children: [
        "\u7B2C",
        job.page_number,
        "\u9875",
        job.kind === "analysis" ? "\u6587\u5B57\u4E0E\u5E03\u5C40\u8BC6\u522B" : "",
        " \xB7 ",
        states[job.state]
      ] }),
      /* @__PURE__ */ jsxs11("p", { className: "break-all", children: [
        "\u4EFB\u52A1 ",
        job.id
      ] }),
      job.reference && /* @__PURE__ */ jsxs11("p", { children: [
        "\u5DF2\u6388\u6743\u53C2\u8003\u7D20\u6750\uFF1A",
        job.reference.label,
        " \xB7 SHA-256 ",
        job.reference.sha256
      ] }),
      /* @__PURE__ */ jsxs11("p", { children: [
        "\u9884\u4F30 ",
        usd(job.estimated_micro_usd),
        job.reported_micro_usd !== null ? ` \xB7 \u670D\u52A1\u62A5\u544A ${usd(job.reported_micro_usd)}` : "",
        " \xB7 ",
        job.provider ?? "\u5C1A\u65E0\u670D\u52A1\u7ED3\u679C",
        " \xB7 ",
        job.model ?? ""
      ] }),
      job.error_code && /* @__PURE__ */ jsx11("p", { role: "alert", children: errors[job.error_code] ?? `\u9519\u8BEF\u8BB0\u5F55 ${job.error_code}` }),
      job.state === "queued" && /* @__PURE__ */ jsx11(Button11, { disabled: execute.isPending || executeBatch.isPending, onClick: () => execute.mutate(job), children: job.kind === "analysis" ? "\u6267\u884C\u6B64\u9875\u6587\u5B57\u4E0E\u5E03\u5C40\u8BC6\u522B" : "\u6267\u884C\u6B64\u9875\u56FE\u7247\u751F\u6210" }),
      ["queued", "running"].includes(job.state) && /* @__PURE__ */ jsx11(Button11, { variant: "secondary", disabled: cancel.isPending || !!job.attempted && !costAcknowledged, onClick: () => cancel.mutate(job), children: "\u53D6\u6D88\u6B64\u56FE\u7247\u4EFB\u52A1" }),
      job.assets.map((asset) => /* @__PURE__ */ jsx11(SlideImagePreview, { route, asset, selected: asset.id === job.asset_id }, asset.id)),
      job.kind === "generation" && ["succeeded", "cached"].includes(job.state) && job.asset_id && /* @__PURE__ */ jsxs11("form", { onSubmit: (event) => reserveAnalysis(event, job.asset_id), className: "grid gap-2", children: [
        /* @__PURE__ */ jsxs11("label", { children: [
          "\u89C6\u89C9\u68C0\u67E5\u4F30\u7B97\u8D39\u7528\uFF08\u7F8E\u5143\uFF09",
          /* @__PURE__ */ jsx11("input", { name: "analysis-estimate", "aria-label": "\u89C6\u89C9\u68C0\u67E5\u4F30\u7B97\u8D39\u7528\uFF08\u7F8E\u5143\uFF09", type: "number", min: "0.000001", max: "1000", step: "0.000001", required: true })
        ] }),
        /* @__PURE__ */ jsxs11("label", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx11("input", { type: "checkbox", required: true }),
          "\u6388\u6743\u5C06\u5F53\u524D\u8BBE\u8BA1\u56FE\u53D1\u9001\u7ED9\u8BFE\u4EF6\u9636\u6BB5\u89C6\u89C9\u6A21\u578B\u5E76\u63A5\u53D7\u4F30\u7B97\u8D39\u7528\uFF0C\u8BC6\u522B\u7ED3\u679C\u540C\u65F6\u7528\u4E8E\u540E\u7EED\u53EF\u7F16\u8F91\u8BFE\u4EF6\u91CD\u5EFA"
        ] }),
        /* @__PURE__ */ jsxs11("label", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx11("input", { type: "checkbox", name: "analysis-force" }),
          "\u91CD\u65B0\u8BC6\u522B\u5F53\u524D\u56FE\u7247\u5E76\u53E6\u8BA1\u8D39\u7528\uFF0C\u4FDD\u7559\u6B64\u524D\u8BC6\u522B\u4EFB\u52A1"
        ] }),
        /* @__PURE__ */ jsx11(Button11, { type: "submit", disabled: analyze.isPending, children: "\u9884\u7559\u6B64\u9875\u6587\u5B57\u4E0E\u5E03\u5C40\u8BC6\u522B" })
      ] }),
      job.analysis.text_check && /* @__PURE__ */ jsxs11("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx11("p", { children: job.analysis.text_check === "matched_extracted_text" ? "\u63D0\u53D6\u6587\u5B57\u4E0E\u84DD\u56FE\u9010\u5B57\u5339\u914D\uFF0C\u5F85\u6559\u5E08\u590D\u6838" : "\u63D0\u53D6\u6587\u5B57\u4E0E\u84DD\u56FE\u5B58\u5728\u5DEE\u5F02\uFF0C\u9700\u8981\u6838\u5BF9\u6216\u91CD\u505A" }),
        job.analysis.missing_text?.map((text, index) => /* @__PURE__ */ jsxs11("p", { role: "alert", children: [
          "\u672A\u5339\u914D\u539F\u6587 ",
          text
        ] }, index)),
        /* @__PURE__ */ jsx11("p", { children: job.analysis.review_note })
      ] })
    ] }, job.id)),
    /* @__PURE__ */ jsxs11("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx11(Button11, { variant: "secondary", disabled: offset === 0, onClick: () => setOffset(Math.max(0, offset - 20)), children: "\u4E0A\u4E00\u7EC4\u56FE\u7247\u4EFB\u52A1" }),
      /* @__PURE__ */ jsx11(Button11, { variant: "secondary", disabled: jobs.data?.next_offset == null, onClick: () => setOffset(jobs.data?.next_offset ?? offset), children: "\u4E0B\u4E00\u7EC4\u56FE\u7247\u4EFB\u52A1" })
    ] }),
    [budget.error, jobs.error, setBudget.error, reserve.error, analyze.error, execute.error, executeBatch.error, cancel.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx11("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/reconstruction-workspace.tsx
import { Button as Button14, useMutation as useMutation14, useQuery as useQuery14, useQueryClient as useQueryClient13 } from "@hermes/plugin-sdk";
import { useState as useState13 } from "react";

// extensions/teacher-assistant/desktop/src/editable-slide.tsx
import { Button as Button13, useMutation as useMutation13, useQuery as useQuery13, useQueryClient as useQueryClient12 } from "@hermes/plugin-sdk";
import { useState as useState12 } from "react";

// extensions/teacher-assistant/desktop/src/reconstruction-api.ts
import { captureGatewayFileDownload as captureGatewayFileDownload3 } from "@hermes/plugin-sdk";
var PAGE_LABELS = { draft: "\u8349\u7A3F", approved: "\u5DF2\u5BA1\u6838", rejected: "\u5DF2\u9000\u56DE" };
var OBJECT_LABELS = { text: "\u6587\u5B57", shape: "\u5F62\u72B6", line: "\u8FDE\u63A5\u7EBF", table: "\u8868\u683C", image: "\u56FE\u7247" };
async function downloadSlides(route, operation, id) {
  const save = captureGatewayFileDownload3();
  const file = await call(route, operation, { id }, crypto.randomUUID());
  await save(file.stored_path, file.filename);
}

// extensions/teacher-assistant/desktop/src/slide-render-preview.tsx
import { Button as Button12, host as host5, useMutation as useMutation12, useQuery as useQuery12, useQueryClient as useQueryClient11 } from "@hermes/plugin-sdk";
import { useState as useState11 } from "react";

// extensions/teacher-assistant/desktop/src/render-api.ts
import { captureGatewayFileDownload as captureGatewayFileDownload4, host as host4 } from "@hermes/plugin-sdk";
async function generateRender(route, pageId, renderer, forceNew, onQueued) {
  const release = await host4.retainProfile(route, { spawnPriority: "foreground" });
  try {
    const job = await call(route, "slide.render.begin", { id: pageId, renderer, force_new: forceNew }, crypto.randomUUID());
    await onQueued?.();
    const result = await host4.requestProfile(route, "plugin.teacher-assistant.call", {
      operation: "slide.render.run",
      data: { id: job.id },
      request_id: job.id
    }, 12e4);
    if (!result.ok) throw new Error(result.error?.message ?? "\u672C\u5730\u6E32\u67D3\u4EFB\u52A1\u672A\u80FD\u5B8C\u6210");
    return result.data;
  } finally {
    release();
  }
}
async function fitMeasuredText(route, job, minimum) {
  const release = await host4.retainProfile(route, { spawnPriority: "foreground" });
  try {
    const result = await call(route, "slide.page.fit_text", { id: job.id, minimum_font_pixels: minimum }, crypto.randomUUID());
    if (result.changed) {
      try {
        await generateRender(route, result.page.id, job.renderer, false);
      } catch (error) {
        result.preview_error = error instanceof Error ? error.message : String(error);
      }
    }
    return result;
  } finally {
    release();
  }
}
async function downloadRender(route, id, variant) {
  const save = captureGatewayFileDownload4();
  const file = await call(route, "slide.render.file", { id, variant });
  await save(file.stored_path, file.filename);
}

// extensions/teacher-assistant/desktop/src/slide-render-preview.tsx
import { jsx as jsx12, jsxs as jsxs12 } from "react/jsx-runtime";
function RenderComparison({ route, job, assetId, onVersion }) {
  const queryClient = useQueryClient11();
  const [visible, setVisible] = useState11(false);
  const previews = useQuery12({
    queryKey: [...routeKey(route), "render-comparison", job.id, assetId],
    queryFn: async () => {
      if (!assetId) {
        return [{ label: "PPTX\u5B9E\u9645\u6E32\u67D3\u56FE", ...await call(route, "slide.render.preview", { id: job.id, variant: "rendered" }) }];
      }
      const [reference, rendered, difference] = await Promise.all([
        call(route, "slide.image.preview", { id: assetId }),
        call(route, "slide.render.preview", { id: job.id, variant: "rendered" }),
        call(route, "slide.render.preview", { id: job.id, variant: "difference" })
      ]);
      return [{ label: "\u539F\u59CB\u8BBE\u8BA1\u56FE", ...reference }, { label: "PPTX\u5B9E\u9645\u6E32\u67D3\u56FE", ...rendered }, { label: "\u50CF\u7D20\u5DEE\u5F02\u56FE", ...difference }];
    },
    enabled: visible,
    staleTime: Infinity
  });
  const download = useMutation12({ mutationFn: (variant) => downloadRender(route, job.id, variant) });
  const repair = useMutation12({
    mutationFn: (minimum) => fitMeasuredText(route, job, minimum),
    onSuccess: async (result) => {
      if (result.changed) {
        if (result.preview_error) host5.notify({ kind: "error", message: "\u4FEE\u590D\u8349\u7A3F\u5DF2\u4FDD\u5B58\uFF0C\u9884\u89C8\u751F\u6210\u5931\u8D25\u3002\u8BF7\u5728\u65B0\u7248\u672C\u4E2D\u91CD\u8BD5\u3002", detail: result.preview_error });
        await queryClient.invalidateQueries({ queryKey: routeKey(route) });
        onVersion(result.page.id);
      }
    },
    retry: false
  });
  function fit(event) {
    event.preventDefault();
    repair.mutate(Number(new FormData(event.currentTarget).get("minimum")));
  }
  return /* @__PURE__ */ jsxs12("div", { className: "space-y-3", children: [
    job.comparison.reference_sha256 && /* @__PURE__ */ jsxs12("p", { children: [
      "RGB\u5E73\u5747\u7EDD\u5BF9\u5DEE ",
      job.comparison.mean_absolute_rgb_error?.toFixed(2),
      " \xB7 \u901A\u9053\u5DEE\u503C\u5927\u4E8E32\u7684\u50CF\u7D20\u5360\u6BD4 ",
      new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 2 }).format(job.comparison.pixels_above_32_fraction)
    ] }),
    /* @__PURE__ */ jsx12("p", { children: job.comparison.review_note }),
    job.comparison.text_bounds && /* @__PURE__ */ jsxs12("p", { children: [
      "\u5DF2\u6D4B\u91CF\u6587\u5B57\u533A\u57DF ",
      job.comparison.text_bounds.measured_regions,
      " \xB7 \u8D85\u6846\u533A\u57DF ",
      job.comparison.text_bounds.overflow_regions,
      " \xB7 \u7F3A\u5C11\u6D4B\u91CF ",
      job.comparison.text_bounds.missing_regions
    ] }),
    /* @__PURE__ */ jsxs12("form", { onSubmit: fit, className: "grid gap-2", children: [
      /* @__PURE__ */ jsxs12("label", { children: [
        "\u4FEE\u590D\u6700\u5C0F\u5B57\u53F7\uFF08\u539F\u56FE\u50CF\u7D20\uFF09",
        /* @__PURE__ */ jsx12("input", { "aria-label": "\u4FEE\u590D\u6700\u5C0F\u5B57\u53F7\uFF08\u539F\u56FE\u50CF\u7D20\uFF09", name: "minimum", type: "number", min: "8", max: "160", step: "0.1", defaultValue: "32", required: true })
      ] }),
      /* @__PURE__ */ jsx12(Button12, { type: "submit", disabled: repair.isPending || !job.comparison.text_bounds?.measured_regions, children: "\u6309\u5B9E\u6D4B\u5B57\u53F7\u4FEE\u590D\u5E76\u751F\u6210\u9884\u89C8" })
    ] }),
    repair.data && !repair.data.changed && /* @__PURE__ */ jsxs12("p", { role: "status", children: [
      "\u5DF2\u68C0\u67E5",
      repair.data.report.measured_regions,
      "\u4E2A\u6587\u5B57\u533A\u57DF\uFF0C",
      repair.data.report.minimum_limited.length,
      "\u4E2A\u5BF9\u8C61\u53D7\u5230\u6700\u5C0F\u5B57\u53F7\u9650\u5236\uFF0C",
      repair.data.report.missing_regions,
      "\u4E2A\u533A\u57DF\u7F3A\u5C11\u6D4B\u91CF\u3002"
    ] }),
    /* @__PURE__ */ jsx12(Button12, { variant: "secondary", onClick: () => setVisible((value) => !value), children: visible ? "\u6536\u8D77\u6E32\u67D3\u5BF9\u7167" : assetId ? "\u67E5\u770B\u6E32\u67D3\u5BF9\u7167" : "\u67E5\u770B\u5B9E\u9645\u6E32\u67D3" }),
    visible && previews.isPending && /* @__PURE__ */ jsx12("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u5B9E\u9645\u6E32\u67D3\u56FE" }),
    visible && previews.data && /* @__PURE__ */ jsx12("div", { className: "grid gap-3", style: { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }, children: previews.data.map((preview) => /* @__PURE__ */ jsxs12("figure", { children: [
      /* @__PURE__ */ jsx12("figcaption", { children: preview.label }),
      /* @__PURE__ */ jsx12("img", { className: "w-full rounded", alt: preview.label, src: `data:${preview.mime_type};base64,${preview.content_base64}` })
    ] }, preview.label)) }),
    /* @__PURE__ */ jsxs12("div", { className: "flex flex-wrap gap-2", children: [
      /* @__PURE__ */ jsx12(Button12, { variant: "secondary", disabled: download.isPending, onClick: () => download.mutate("rendered"), children: "\u4E0B\u8F7D\u5B9E\u9645\u6E32\u67D3PNG" }),
      job.comparison.reference_sha256 && /* @__PURE__ */ jsx12(Button12, { variant: "secondary", disabled: download.isPending, onClick: () => download.mutate("difference"), children: "\u4E0B\u8F7D\u50CF\u7D20\u5DEE\u5F02PNG" })
    ] }),
    [previews.error, download.error, repair.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx12("p", { role: "alert", children: error?.message }, index))
  ] });
}
function SlideRenderPreview({ route, pageId, assetId, onVersion }) {
  const queryClient = useQueryClient11();
  const [offset, setOffset] = useState11(0);
  const key = [...routeKey(route), "slide-renders", pageId];
  const jobs = useQuery12({
    queryKey: [...key, offset],
    queryFn: () => call(route, "slide.render.list", { id: pageId, offset }),
    refetchInterval: (query) => query.state.data?.items.some((job) => ["queued", "running"].includes(job.state)) ? 3e3 : false
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const generate = useMutation12({ mutationFn: ({ renderer, force }) => generateRender(route, pageId, renderer, force, refresh), retry: false, onSettled: refresh });
  function render(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    generate.mutate({ renderer: String(form.get("renderer")), force: form.has("force") });
  }
  const states = { queued: "\u5F85\u6E32\u67D3", running: "\u6E32\u67D3\u4E2D", succeeded: "\u6E32\u67D3\u5B8C\u6210", failed: "\u6E32\u67D3\u5931\u8D25" };
  const engines = { wps: "WPS\u6F14\u793A", powerpoint: "Microsoft PowerPoint" };
  const errors = { office_unavailable: "\u6240\u9009\u529E\u516C\u8F6F\u4EF6\u672A\u80FD\u542F\u52A8", office_render_failed: "\u529E\u516C\u8F6F\u4EF6\u6E32\u67D3\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8F6F\u4EF6\u72B6\u6001", render_timeout: "\u6E32\u67D3\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u529E\u516C\u8F6F\u4EF6\u72B6\u6001", render_file_access_failed: "\u9884\u89C8\u6587\u4EF6\u65E0\u6CD5\u4FDD\u5B58\uFF0C\u8BF7\u68C0\u67E5\u78C1\u76D8\u548C\u6743\u9650", render_response_invalid: "\u529E\u516C\u8F6F\u4EF6\u672A\u8FD4\u56DE\u6709\u6548\u9884\u89C8\uFF0C\u8BF7\u67E5\u770B\u8FD0\u884C\u65E5\u5FD7", file_integrity_error: "\u6E32\u67D3\u6240\u9700\u6587\u4EF6\u672A\u901A\u8FC7\u5B8C\u6574\u6027\u6821\u9A8C", render_execution_failed: "\u6E32\u67D3\u6267\u884C\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u8FD0\u884C\u65E5\u5FD7" };
  return /* @__PURE__ */ jsxs12("section", { "aria-label": "\u5B9E\u9645\u6E32\u67D3\u4E0E\u8BBE\u8BA1\u56FE\u5BF9\u7167", className: "space-y-4", children: [
    /* @__PURE__ */ jsx12("h4", { className: "font-semibold", children: "\u5B9E\u9645\u6E32\u67D3\u4E0E\u8BBE\u8BA1\u56FE\u5BF9\u7167" }),
    /* @__PURE__ */ jsx12("p", { children: "\u4F7F\u7528\u8FD0\u884CHermes\u7684Windows\u4E3B\u673A\u4E0A\u5DF2\u5B89\u88C5\u7684\u529E\u516C\u8F6F\u4EF6\u751F\u6210\u9884\u89C8\uFF0C\u7ED1\u5B9A\u5F53\u524D\u9875\u9762\u7248\u672C\u3002\u53EF\u5728\u8349\u7A3F\u9636\u6BB5\u68C0\u67E5\u6392\u7248\u3002" }),
    /* @__PURE__ */ jsxs12("form", { onSubmit: render, className: "grid gap-2", children: [
      /* @__PURE__ */ jsxs12("label", { children: [
        "\u672C\u5730\u6E32\u67D3\u8F6F\u4EF6",
        /* @__PURE__ */ jsxs12("select", { name: "renderer", "aria-label": "\u672C\u5730\u6E32\u67D3\u8F6F\u4EF6", children: [
          /* @__PURE__ */ jsx12("option", { value: "wps", children: "WPS\u6F14\u793A" }),
          /* @__PURE__ */ jsx12("option", { value: "powerpoint", children: "Microsoft PowerPoint" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs12("label", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx12("input", { type: "checkbox", name: "force" }),
        "\u65B0\u5EFA\u672C\u9875\u6E32\u67D3\u4EFB\u52A1\uFF0C\u4FDD\u7559\u6B64\u524D\u9884\u89C8"
      ] }),
      /* @__PURE__ */ jsx12(Button12, { type: "submit", disabled: generate.isPending, children: "\u751F\u6210\u5B9E\u9645\u9875\u9762\u9884\u89C8" })
    ] }),
    /* @__PURE__ */ jsx12(Button12, { variant: "secondary", onClick: () => void refresh(), children: "\u5237\u65B0\u6E32\u67D3\u4EFB\u52A1" }),
    jobs.data?.items.map((job) => /* @__PURE__ */ jsxs12("article", { className: "space-y-3 rounded border border-(--ui-border) p-3", children: [
      /* @__PURE__ */ jsxs12("p", { children: [
        states[job.state],
        " \xB7 ",
        engines[job.renderer],
        " ",
        job.renderer_version ?? ""
      ] }),
      job.error_code && /* @__PURE__ */ jsx12("p", { role: "alert", children: errors[job.error_code] ?? job.error_code }),
      job.state === "succeeded" && /* @__PURE__ */ jsx12(RenderComparison, { route, job, assetId, onVersion })
    ] }, job.id)),
    /* @__PURE__ */ jsxs12("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx12(Button12, { variant: "secondary", disabled: offset === 0, onClick: () => setOffset(Math.max(0, offset - 20)), children: "\u4E0A\u4E00\u7EC4\u6E32\u67D3\u8BB0\u5F55" }),
      /* @__PURE__ */ jsx12(Button12, { variant: "secondary", disabled: jobs.data?.next_offset == null, onClick: () => setOffset(jobs.data?.next_offset ?? offset), children: "\u4E0B\u4E00\u7EC4\u6E32\u67D3\u8BB0\u5F55" })
    ] }),
    [jobs.error, generate.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx12("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/editable-slide.tsx
import { Fragment as Fragment7, jsx as jsx13, jsxs as jsxs13 } from "react/jsx-runtime";
function EditableSlide({ route, pageId, onVersion }) {
  const queryClient = useQueryClient12();
  const [index, setIndex] = useState12(0);
  const [confirmed, setConfirmed] = useState12(false);
  const page = useQuery13({ queryKey: [...routeKey(route), "editable-page", pageId], queryFn: () => call(route, "slide.page.get", { id: pageId }) });
  const saved = page.data;
  const element = saved?.layout.elements[index];
  const revise = useMutation13({
    mutationFn: (layout) => call(route, "slide.page.revise", { id: pageId, layout }, crypto.randomUUID()),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: [...routeKey(route), "slide-pages"] });
      onVersion(updated.id);
    }
  });
  const review = useMutation13({
    mutationFn: (data) => call(route, "slide.page.review", { id: pageId, ...data }, crypto.randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: routeKey(route) })
  });
  const download = useMutation13({ mutationFn: () => downloadSlides(route, saved?.status === "approved" ? "slide.page.export" : "slide.page.preview_export", pageId) });
  function saveElement(event) {
    event.preventDefault();
    if (!saved || !element) return;
    const form = new FormData(event.currentTarget);
    const layout = structuredClone(saved.layout);
    const edited = layout.elements[index];
    edited.x = Number(form.get("x"));
    edited.y = Number(form.get("y"));
    edited.width = Number(form.get("width"));
    edited.height = Number(form.get("height"));
    if (edited.kind === "text") edited.text = String(form.get("text"));
    if (edited.kind === "text" || edited.kind === "table") {
      edited.font_size = Number(form.get("font_size"));
      edited.color = String(form.get("color"));
    }
    if (edited.kind === "table") {
      edited.rows = edited.rows.map((row, rowIndex) => row.map((_, columnIndex) => String(form.get(`cell-${rowIndex}-${columnIndex}`))));
    }
    if (edited.kind === "shape") {
      edited.fill = String(form.get("fill")) || null;
      edited.line_color = String(form.get("line_color")) || null;
    }
    if (edited.kind === "image") {
      edited.source_x = Number(form.get("source_x"));
      edited.source_y = Number(form.get("source_y"));
      edited.source_width = Number(form.get("source_width"));
      edited.source_height = Number(form.get("source_height"));
      edited.description = String(form.get("description"));
    }
    revise.mutate(layout);
  }
  function approve(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    review.mutate({ note: String(form.get("note")), decision: form.get("decision") });
  }
  return /* @__PURE__ */ jsxs13("article", { className: "space-y-3", "aria-label": "\u53EF\u7F16\u8F91\u9875\u9762\u5BF9\u8C61", children: [
    saved && /* @__PURE__ */ jsxs13(Fragment7, { children: [
      /* @__PURE__ */ jsxs13("h4", { children: [
        "\u53EF\u7F16\u8F91\u7B2C",
        saved.page_number,
        "\u9875 \xB7 v",
        saved.version,
        " \xB7 ",
        PAGE_LABELS[saved.status]
      ] }),
      /* @__PURE__ */ jsxs13("p", { children: [
        "\u9875\u9762\u6765\u6E90\uFF1A",
        saved.source_mode === "blueprint" ? "\u84DD\u56FE\u7ED3\u6784\u5316\u5907\u7528\u6A21\u5F0F" : "\u8BBE\u8BA1\u56FE\u7247\u89C6\u89C9\u8FD8\u539F"
      ] }),
      /* @__PURE__ */ jsxs13("p", { children: [
        "\u9875\u9762\u5BF9\u8C61 ",
        Object.entries(saved.object_counts).map(([kind, count]) => `${OBJECT_LABELS[kind]} ${count}`).join(" \xB7 ")
      ] }),
      /* @__PURE__ */ jsx13("p", { children: "\u6587\u5B57\u3001\u5F62\u72B6\u3001\u8FDE\u63A5\u7EBF\u4E0E\u8868\u683C\u4E3A\u539F\u751F\u5BF9\u8C61\u3002\u7167\u7247\u548C\u590D\u6742\u63D2\u753B\u4FDD\u5B58\u4E3A\u72EC\u7ACB\u88C1\u5207\u56FE\u7247\uFF0C\u652F\u6301\u79FB\u52A8\u3001\u7F29\u653E\u548C\u88C1\u5207\u3002\u5750\u6807\u4E0E\u5C3A\u5BF8\u91C7\u7528\u539F\u56FE\u50CF\u7D20\u3002" }),
      saved.repair && /* @__PURE__ */ jsxs13("p", { role: "status", children: [
        "\u6B64\u7248\u672C\u4F9D\u636E\u5B9E\u9645\u6587\u5B57\u8FB9\u754C\u4FEE\u590D\u4E86",
        saved.repair.report.changes.length,
        "\u4E2A\u5BF9\u8C61\u7684\u5B57\u53F7\u3002\u6700\u5C0F\u5B57\u53F7\u8BBE\u7F6E\u4E3A",
        saved.repair.minimum_font_pixels,
        "\u539F\u56FE\u50CF\u7D20\uFF0C",
        saved.repair.report.minimum_limited.length,
        "\u4E2A\u5BF9\u8C61\u8FBE\u5230\u8BE5\u9650\u5236\uFF0C",
        saved.repair.report.missing_regions,
        "\u4E2A\u533A\u57DF\u7F3A\u5C11\u6D4B\u91CF\u3002"
      ] }),
      saved.text_check.missing_text.map((text, i) => /* @__PURE__ */ jsxs13("p", { role: "alert", children: [
        "\u9875\u9762\u7F3A\u5C11\u84DD\u56FE\u6587\u5B57 ",
        text
      ] }, i)),
      /* @__PURE__ */ jsxs13("label", { children: [
        "\u7F16\u8F91\u9875\u9762\u5BF9\u8C61",
        /* @__PURE__ */ jsx13("select", { "aria-label": "\u7F16\u8F91\u9875\u9762\u5BF9\u8C61", value: index, onChange: (event) => setIndex(Number(event.target.value)), children: saved.layout.elements.map((element2, i) => /* @__PURE__ */ jsxs13("option", { value: i, children: [
          element2.name,
          " \xB7 ",
          OBJECT_LABELS[element2.kind]
        ] }, element2.name)) })
      ] }),
      element && /* @__PURE__ */ jsxs13("form", { onSubmit: saveElement, className: "grid max-w-3xl gap-2", children: [
        [["x", "\u6C34\u5E73\u4F4D\u7F6E"], ["y", "\u5782\u76F4\u4F4D\u7F6E"], ["width", "\u5BBD\u5EA6"], ["height", "\u9AD8\u5EA6"]].map(([key, label]) => /* @__PURE__ */ jsxs13("label", { children: [
          label,
          /* @__PURE__ */ jsx13("input", { "aria-label": `\u5BF9\u8C61${label}`, type: "number", name: key, min: key === "x" || key === "y" ? 0 : 0.01, step: "0.01", defaultValue: element[key], required: true })
        ] }, key)),
        element.kind === "text" && /* @__PURE__ */ jsxs13("label", { children: [
          "\u5BF9\u8C61\u6587\u5B57",
          /* @__PURE__ */ jsx13("textarea", { "aria-label": "\u5BF9\u8C61\u6587\u5B57", name: "text", defaultValue: element.text, maxLength: 5e3, className: "min-h-28 w-full rounded border border-(--ui-border) p-3", required: true })
        ] }),
        element.kind === "table" && /* @__PURE__ */ jsxs13("fieldset", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx13("legend", { children: "\u8868\u683C\u5355\u5143\u683C" }),
          element.rows.map((row, rowIndex) => /* @__PURE__ */ jsx13("div", { className: "flex flex-wrap gap-2", children: row.map((cell, columnIndex) => /* @__PURE__ */ jsxs13("label", { children: [
            "\u7B2C",
            rowIndex + 1,
            "\u884C\u7B2C",
            columnIndex + 1,
            "\u5217",
            /* @__PURE__ */ jsx13("input", { "aria-label": `\u8868\u683C\u7B2C${rowIndex + 1}\u884C\u7B2C${columnIndex + 1}\u5217`, name: `cell-${rowIndex}-${columnIndex}`, defaultValue: cell, maxLength: 2e3 })
          ] }, columnIndex)) }, rowIndex))
        ] }),
        (element.kind === "text" || element.kind === "table") && /* @__PURE__ */ jsxs13(Fragment7, { children: [
          /* @__PURE__ */ jsxs13("label", { children: [
            "\u5BF9\u8C61\u5B57\u53F7",
            /* @__PURE__ */ jsx13("input", { "aria-label": "\u5BF9\u8C61\u5B57\u53F7", name: "font_size", type: "number", min: "8", max: element.kind === "table" ? 100 : 160, step: "0.1", defaultValue: element.font_size, required: true })
          ] }),
          /* @__PURE__ */ jsxs13("label", { children: [
            "\u5BF9\u8C61\u6587\u5B57\u989C\u8272",
            /* @__PURE__ */ jsx13("input", { "aria-label": "\u5BF9\u8C61\u6587\u5B57\u989C\u8272", name: "color", pattern: "[0-9A-Fa-f]{6}", defaultValue: element.color, required: true })
          ] })
        ] }),
        element.kind === "shape" && /* @__PURE__ */ jsxs13(Fragment7, { children: [
          /* @__PURE__ */ jsxs13("label", { children: [
            "\u5BF9\u8C61\u586B\u5145\u989C\u8272",
            /* @__PURE__ */ jsx13("input", { "aria-label": "\u5BF9\u8C61\u586B\u5145\u989C\u8272", name: "fill", pattern: "[0-9A-Fa-f]{6}", defaultValue: element.fill ?? "" })
          ] }),
          /* @__PURE__ */ jsxs13("label", { children: [
            "\u5BF9\u8C61\u8FB9\u7EBF\u989C\u8272",
            /* @__PURE__ */ jsx13("input", { "aria-label": "\u5BF9\u8C61\u8FB9\u7EBF\u989C\u8272", name: "line_color", pattern: "[0-9A-Fa-f]{6}", defaultValue: element.line_color ?? "" })
          ] })
        ] }),
        element.kind === "image" && /* @__PURE__ */ jsxs13("fieldset", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx13("legend", { children: "\u539F\u56FE\u88C1\u5207\u533A\u57DF" }),
          [["source_x", "\u88C1\u5207\u6C34\u5E73\u4F4D\u7F6E"], ["source_y", "\u88C1\u5207\u5782\u76F4\u4F4D\u7F6E"], ["source_width", "\u88C1\u5207\u5BBD\u5EA6"], ["source_height", "\u88C1\u5207\u9AD8\u5EA6"]].map(([key, label]) => /* @__PURE__ */ jsxs13("label", { children: [
            label,
            /* @__PURE__ */ jsx13("input", { "aria-label": label, name: key, type: "number", min: key === "source_x" || key === "source_y" ? 0 : 1, step: "0.01", defaultValue: element[key], required: true })
          ] }, key)),
          /* @__PURE__ */ jsxs13("label", { children: [
            "\u56FE\u7247\u8BF4\u660E",
            /* @__PURE__ */ jsx13("input", { "aria-label": "\u56FE\u7247\u8BF4\u660E", name: "description", defaultValue: element.description, maxLength: 500, required: true })
          ] })
        ] }),
        /* @__PURE__ */ jsx13(Button13, { type: "submit", disabled: revise.isPending, children: "\u4FDD\u5B58\u9875\u9762\u5BF9\u8C61\u4E3A\u65B0\u7248\u672C" })
      ] }, `${pageId}:${element.name}`),
      /* @__PURE__ */ jsx13(Button13, { variant: "secondary", disabled: download.isPending, onClick: () => download.mutate(), children: saved.status === "approved" ? "\u4E0B\u8F7D\u5355\u9875\u53EF\u7F16\u8F91PPTX" : "\u4E0B\u8F7D\u5355\u9875\u8349\u7A3FPPTX" }),
      /* @__PURE__ */ jsx13(SlideRenderPreview, { route, pageId, assetId: saved.asset_id, onVersion }),
      saved.status === "draft" && /* @__PURE__ */ jsxs13("form", { onSubmit: approve, className: "grid max-w-3xl gap-2", children: [
        /* @__PURE__ */ jsxs13("label", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx13("input", { type: "checkbox", checked: confirmed, onChange: (event) => setConfirmed(event.target.checked), required: true }),
          "\u5DF2\u6838\u5BF9\u539F\u751F\u6587\u5B57\u3001\u56FE\u5F62\u3001\u8868\u683C\u3001\u4F4D\u7F6E\u53CA\u6559\u6750\u5185\u5BB9"
        ] }),
        /* @__PURE__ */ jsxs13("label", { children: [
          "\u53EF\u7F16\u8F91\u9875\u9762\u5BA1\u6838\u7ED3\u679C",
          /* @__PURE__ */ jsxs13("select", { name: "decision", "aria-label": "\u53EF\u7F16\u8F91\u9875\u9762\u5BA1\u6838\u7ED3\u679C", children: [
            /* @__PURE__ */ jsx13("option", { value: "approved", children: "\u901A\u8FC7" }),
            /* @__PURE__ */ jsx13("option", { value: "rejected", children: "\u9000\u56DE\u4FEE\u8BA2" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs13("label", { children: [
          "\u53EF\u7F16\u8F91\u9875\u9762\u5BA1\u6838\u610F\u89C1",
          /* @__PURE__ */ jsx13("input", { "aria-label": "\u53EF\u7F16\u8F91\u9875\u9762\u5BA1\u6838\u610F\u89C1", name: "note", maxLength: 2e3, required: true })
        ] }),
        /* @__PURE__ */ jsx13(Button13, { type: "submit", disabled: !confirmed || review.isPending, children: "\u5BA1\u6838\u901A\u8FC7\u53EF\u7F16\u8F91\u9875\u9762" })
      ] })
    ] }),
    [page.error, revise.error, review.error, download.error].filter(Boolean).map((error, i) => /* @__PURE__ */ jsx13("p", { role: "alert", children: error?.message }, i))
  ] });
}

// extensions/teacher-assistant/desktop/src/reconstruction-workspace.tsx
import { jsx as jsx14, jsxs as jsxs14 } from "react/jsx-runtime";
function ReconstructionWorkspace({ route, blueprintId }) {
  const queryClient = useQueryClient13();
  const [analysisId, setAnalysisId] = useState13("");
  const [pageId, setPageId] = useState13("");
  const [offset, setOffset] = useState13(0);
  const analyses = useQuery14({ queryKey: [...routeKey(route), "images", blueprintId, "layout-analyses", offset], queryFn: () => call(route, "slide.image.list", { blueprint_id: blueprintId, limit: 100, offset }), refetchInterval: 3e3 });
  const pages = useQuery14({ queryKey: [...routeKey(route), "slide-pages", blueprintId], queryFn: () => call(route, "slide.page.list", { blueprint_id: blueprintId, limit: 100 }) });
  const create = useMutation14({
    mutationFn: async () => {
      const job = analyses.data?.items.find((item) => item.id === analysisId);
      if (!job) throw new Error("\u8BF7\u5148\u9009\u62E9\u5DF2\u5B8C\u6210\u7684\u8BC6\u522B\u4EFB\u52A1");
      const history = await call(route, "slide.page.list", { blueprint_id: blueprintId, page_number: job.page_number, limit: 1 });
      const previous = history.items[0];
      return call(route, "slide.page.from_analysis", { id: analysisId, expected_version: previous?.version ?? 0 }, crypto.randomUUID());
    },
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: [...routeKey(route), "slide-pages"] });
      setPageId(page.id);
    }
  });
  const download = useMutation14({ mutationFn: () => downloadSlides(route, "slide.deck.export", blueprintId) });
  const template = useMutation14({
    mutationFn: () => call(route, "slide.deck.from_blueprint", { id: blueprintId }, crypto.randomUUID()),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: [...routeKey(route), "slide-pages"] });
      setPageId(result.items[0].id);
    }
  });
  return /* @__PURE__ */ jsxs14("section", { "aria-label": "\u56FE\u7247\u8F6C\u53EF\u7F16\u8F91\u8BFE\u4EF6", className: "space-y-4", children: [
    /* @__PURE__ */ jsx14("h3", { className: "text-lg font-semibold", children: "\u56FE\u7247\u8F6C\u53EF\u7F16\u8F91\u8BFE\u4EF6" }),
    /* @__PURE__ */ jsx14("p", { children: "\u590D\u7528\u5DF2\u5B8C\u6210\u7684\u89C6\u89C9\u5E03\u5C40\u8BC6\u522B\uFF0C\u6559\u5E08\u5148\u5BA1\u6838\u8BBE\u8BA1\u56FE\uFF0C\u518D\u5EFA\u7ACB\u53EF\u7F16\u8F91\u9875\u9762\u3002\u5B8C\u6574\u5BFC\u51FA\u9010\u9875\u9009\u62E9\u6700\u65B0\u5DF2\u5BA1\u6838\u7248\u672C\u3002" }),
    /* @__PURE__ */ jsxs14("label", { children: [
      "\u89C6\u89C9\u5E03\u5C40\u4EFB\u52A1",
      /* @__PURE__ */ jsxs14("select", { "aria-label": "\u89C6\u89C9\u5E03\u5C40\u4EFB\u52A1", value: analysisId, onChange: (event) => setAnalysisId(event.target.value), children: [
        /* @__PURE__ */ jsx14("option", { value: "", children: "\u9009\u62E9\u5DF2\u5B8C\u6210\u7684\u8BC6\u522B\u4EFB\u52A1" }),
        analyses.data?.items.filter((job) => job.kind === "analysis" && job.state === "succeeded").map((job) => /* @__PURE__ */ jsxs14("option", { value: job.id, children: [
          "\u7B2C",
          job.page_number,
          "\u9875 \xB7 ",
          job.id
        ] }, job.id))
      ] })
    ] }),
    /* @__PURE__ */ jsxs14("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx14(Button14, { variant: "secondary", disabled: offset === 0, onClick: () => {
        setOffset(Math.max(0, offset - 100));
        setAnalysisId("");
      }, children: "\u4E0A\u4E00\u7EC4\u8BC6\u522B\u8BB0\u5F55" }),
      /* @__PURE__ */ jsx14(Button14, { variant: "secondary", disabled: analyses.data?.next_offset == null, onClick: () => {
        setOffset(analyses.data?.next_offset ?? offset);
        setAnalysisId("");
      }, children: "\u4E0B\u4E00\u7EC4\u8BC6\u522B\u8BB0\u5F55" })
    ] }),
    /* @__PURE__ */ jsx14(Button14, { disabled: !analysisId || create.isPending, onClick: () => create.mutate(), children: "\u4ECE\u8BC6\u522B\u5E03\u5C40\u5EFA\u7ACB\u53EF\u7F16\u8F91\u9875\u9762" }),
    /* @__PURE__ */ jsx14("p", { children: "\u5907\u7528\u6A21\u5F0F\u53EF\u76F4\u63A5\u7528\u5DF2\u5BA1\u6838\u84DD\u56FE\u7684\u51C6\u786E\u6587\u5B57\u751F\u6210\u6574\u5957\u53EF\u7F16\u8F91\u8349\u7A3F\uFF0C\u65E0\u9700\u751F\u56FE\u3002\u5DF2\u6709\u5BA1\u6838\u6210\u679C\u4FDD\u7559\uFF0C\u65B0\u8349\u7A3F\u9700\u9010\u9875\u590D\u6838\u3002" }),
    /* @__PURE__ */ jsx14(Button14, { variant: "secondary", disabled: template.isPending, onClick: () => template.mutate(), children: "\u4ECE\u84DD\u56FE\u751F\u6210\u6574\u5957\u7ED3\u6784\u5316\u8349\u7A3F" }),
    /* @__PURE__ */ jsxs14("label", { children: [
      "\u53EF\u7F16\u8F91\u9875\u9762\u7248\u672C",
      /* @__PURE__ */ jsxs14("select", { "aria-label": "\u53EF\u7F16\u8F91\u9875\u9762\u7248\u672C", value: pageId, onChange: (event) => setPageId(event.target.value), children: [
        /* @__PURE__ */ jsx14("option", { value: "", children: "\u9009\u62E9\u53EF\u7F16\u8F91\u9875\u9762" }),
        pages.data?.items.map((page) => /* @__PURE__ */ jsxs14("option", { value: page.id, children: [
          "\u7B2C",
          page.page_number,
          "\u9875 \xB7 v",
          page.version,
          " \xB7 ",
          PAGE_LABELS[page.status]
        ] }, page.id))
      ] })
    ] }),
    pageId && /* @__PURE__ */ jsx14(EditableSlide, { route, pageId, onVersion: setPageId }, pageId),
    /* @__PURE__ */ jsx14(Button14, { disabled: download.isPending, onClick: () => download.mutate(), children: "\u4E0B\u8F7D\u5B8C\u6574\u53EF\u7F16\u8F91PPTX" }),
    [analyses.error, pages.error, create.error, template.error, download.error].filter(Boolean).map((error, i) => /* @__PURE__ */ jsx14("p", { role: "alert", children: error?.message }, i))
  ] });
}

// extensions/teacher-assistant/desktop/src/blueprint-editor.tsx
import { Fragment as Fragment8, jsx as jsx15, jsxs as jsxs15 } from "react/jsx-runtime";
var LAYOUTS = [["single_column", "\u5355\u680F"], ["two_column", "\u53CC\u680F"], ["three_column", "\u4E09\u680F"], ["comparison", "\u5BF9\u6BD4"], ["timeline", "\u65F6\u95F4\u7EBF"], ["table", "\u8868\u683C"]];
function BlueprintEditor({ route, documentId, onVersion }) {
  const queryClient = useQueryClient14();
  const [pageNumber, setPageNumber] = useState14(1);
  const [confirmed, setConfirmed] = useState14(false);
  const document = useQuery15({ queryKey: [...routeKey(route), "blueprint", documentId], queryFn: () => call(route, "document.get", { id: documentId }) });
  const themes = useQuery15({ queryKey: [...routeKey(route), "slide-themes"], queryFn: () => call(route, "slide.themes") });
  const prompt = useMutation15({ mutationFn: () => call(route, "slide.prompt", { id: documentId, page_number: pageNumber }) });
  const write = useMutation15({
    mutationFn: ({ operation, data }) => call(route, operation, data, crypto.randomUUID()),
    onSuccess: async (saved2) => {
      await queryClient.invalidateQueries({ queryKey: routeKey(route) });
      onVersion(saved2.id);
    }
  });
  const saved = document.data;
  const page = saved?.content.pages.find((page2) => page2.number === pageNumber);
  function savePage(event) {
    event.preventDefault();
    if (!saved) return;
    const form = new FormData(event.currentTarget);
    const content = structuredClone(saved.content);
    content.theme = String(form.get("theme"));
    content.pages = content.pages.map((page2) => page2.number === pageNumber ? {
      ...page2,
      title: String(form.get("title")),
      key_messages: String(form.get("messages")).split("\n").filter((message) => message.trim()),
      duration_minutes: Number(form.get("minutes")),
      teacher_notes: String(form.get("notes")),
      layout: String(form.get("layout")),
      visual_requirements: String(form.get("visual_requirements"))
    } : page2);
    write.mutate({ operation: "document.save", data: {
      lesson_id: saved.lesson_id,
      kind: "slide_blueprint",
      expected_version: saved.version,
      script_id: saved.script_id,
      plan_id: saved.plan_id,
      content
    } });
  }
  return /* @__PURE__ */ jsxs15("article", { className: "space-y-4", "aria-label": "\u8BFE\u4EF6\u84DD\u56FE\u7F16\u8F91\u4E0E\u5BA1\u6838", children: [
    saved && /* @__PURE__ */ jsxs15(Fragment8, { children: [
      /* @__PURE__ */ jsxs15("h3", { className: "text-lg font-semibold", children: [
        saved.content.title,
        " \xB7 v",
        saved.version,
        " \xB7 ",
        saved.status === "approved" ? "\u5DF2\u5BA1\u6838" : saved.status === "rejected" ? "\u5DF2\u9000\u56DE" : "\u8349\u7A3F"
      ] }),
      /* @__PURE__ */ jsxs15("p", { children: [
        "\u5173\u8054\u6388\u8BFE\u7A3F ",
        saved.script_id,
        " \xB7 \u6559\u6848 ",
        saved.plan_id
      ] }),
      /* @__PURE__ */ jsx15("ol", { className: "space-y-2", children: saved.content.pages.map((page2) => /* @__PURE__ */ jsx15("li", { children: /* @__PURE__ */ jsxs15(Button15, { variant: page2.number === pageNumber ? "secondary" : "ghost", onClick: () => {
        setPageNumber(page2.number);
        prompt.reset();
      }, children: [
        "\u7B2C",
        page2.number,
        "\u9875 ",
        page2.title,
        " \xB7 \u7B2C",
        page2.unit_index + 1,
        "\u5355\u5143 \xB7 ",
        page2.duration_minutes,
        "\u5206\u949F"
      ] }) }, page2.number)) })
    ] }),
    saved && page && themes.data && /* @__PURE__ */ jsxs15("form", { onSubmit: savePage, className: "grid max-w-4xl gap-3", children: [
      /* @__PURE__ */ jsxs15("label", { children: [
        "\u8BFE\u4EF6\u4E3B\u9898",
        /* @__PURE__ */ jsx15("select", { "aria-label": "\u8BFE\u4EF6\u4E3B\u9898", name: "theme", defaultValue: saved.content.theme, children: themes.data?.items.map((theme) => /* @__PURE__ */ jsx15("option", { value: theme.id, children: theme.name }, theme.id)) })
      ] }),
      /* @__PURE__ */ jsxs15("label", { children: [
        "\u9875\u9762\u6807\u9898",
        /* @__PURE__ */ jsx15("input", { "aria-label": "\u9875\u9762\u6807\u9898", name: "title", defaultValue: page.title, maxLength: 60, required: true })
      ] }),
      /* @__PURE__ */ jsxs15("label", { children: [
        "\u51C6\u786E\u53EF\u89C1\u6587\u5B57",
        /* @__PURE__ */ jsx15("textarea", { "aria-label": "\u51C6\u786E\u53EF\u89C1\u6587\u5B57", name: "messages", defaultValue: page.key_messages.join("\n"), className: "min-h-32 w-full rounded border border-(--ui-border) p-3", required: true })
      ] }),
      /* @__PURE__ */ jsxs15("label", { children: [
        "\u9875\u9762\u6559\u5B66\u5206\u949F",
        /* @__PURE__ */ jsx15("input", { "aria-label": "\u9875\u9762\u6559\u5B66\u5206\u949F", name: "minutes", type: "number", min: 0.1, max: 40, step: 0.1, defaultValue: page.duration_minutes, required: true })
      ] }),
      /* @__PURE__ */ jsxs15("label", { children: [
        "\u9875\u9762\u5E03\u5C40",
        /* @__PURE__ */ jsx15("select", { "aria-label": "\u9875\u9762\u5E03\u5C40", name: "layout", defaultValue: page.layout, children: LAYOUTS.map(([key, label]) => /* @__PURE__ */ jsx15("option", { value: key, children: label }, key)) })
      ] }),
      /* @__PURE__ */ jsxs15("label", { children: [
        "\u6559\u5E08\u5907\u6CE8",
        /* @__PURE__ */ jsx15("textarea", { "aria-label": "\u9875\u9762\u6559\u5E08\u5907\u6CE8", name: "notes", defaultValue: page.teacher_notes, className: "w-full rounded border border-(--ui-border) p-3", required: true })
      ] }),
      /* @__PURE__ */ jsxs15("label", { children: [
        "\u89C6\u89C9\u8981\u6C42",
        /* @__PURE__ */ jsx15("textarea", { "aria-label": "\u9875\u9762\u89C6\u89C9\u8981\u6C42", name: "visual_requirements", defaultValue: page.visual_requirements, className: "w-full rounded border border-(--ui-border) p-3" })
      ] }),
      /* @__PURE__ */ jsxs15("p", { children: [
        "\u6559\u6750\u6765\u6E90 ",
        page.source_ids.join("\u3001")
      ] }),
      /* @__PURE__ */ jsxs15("p", { children: [
        "\u77E5\u8BC6\u70B9 ",
        page.knowledge_point_ids.join("\u3001")
      ] }),
      /* @__PURE__ */ jsxs15("p", { children: [
        "\u6388\u8BFE\u7A3F\u73AF\u8282 ",
        page.script_references.map((reference) => `${reference.unit_index + 1}\u5355\u5143${reference.segment_index + 1}\u73AF\u8282`).join("\u3001")
      ] }),
      page.visuals.map((visual, index) => /* @__PURE__ */ jsxs15("p", { children: [
        "\u56FE\u89E3\u8981\u6C42 ",
        visual.description
      ] }, index)),
      /* @__PURE__ */ jsx15(Button15, { type: "submit", disabled: write.isPending, children: "\u4FDD\u5B58\u9875\u9762\u4E3A\u84DD\u56FE\u65B0\u7248\u672C" })
    ] }, `${saved.id}:${page.number}`),
    page && /* @__PURE__ */ jsx15(Button15, { disabled: prompt.isPending, onClick: () => prompt.mutate(), children: "\u67E5\u770B\u81EA\u52A8\u751F\u56FE\u63D0\u793A\u8BCD" }),
    prompt.data && /* @__PURE__ */ jsx15("textarea", { "aria-label": "\u81EA\u52A8\u751F\u56FE\u63D0\u793A\u8BCD", readOnly: true, value: prompt.data.prompt, className: "min-h-64 w-full rounded border border-(--ui-border) p-3" }),
    saved?.status === "draft" && /* @__PURE__ */ jsxs15("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsxs15("label", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx15("input", { type: "checkbox", checked: confirmed, onChange: (event) => setConfirmed(event.target.checked) }),
        "\u5DF2\u6838\u5BF9\u5168\u90E8\u9875\u9762\u7684\u6587\u5B57\u3001\u6765\u6E90\u548C\u6559\u5B66\u73AF\u8282"
      ] }),
      /* @__PURE__ */ jsx15(Button15, { disabled: !confirmed || write.isPending, onClick: () => write.mutate({ operation: "document.review", data: { id: documentId, decision: "approved" } }), children: "\u5BA1\u6838\u901A\u8FC7\u84DD\u56FE\u7248\u672C" })
    ] }),
    saved?.status === "approved" && /* @__PURE__ */ jsx15(SlideImages, { route, blueprint: saved }, saved.id),
    saved?.status === "approved" && /* @__PURE__ */ jsx15(ReconstructionWorkspace, { route, blueprintId: saved.id }, `reconstruction:${saved.id}`),
    [document.error, themes.error, prompt.error, write.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx15("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/slides-workspace.tsx
import { Fragment as Fragment9, jsx as jsx16, jsxs as jsxs16 } from "react/jsx-runtime";
function SlidesWorkspace({ route }) {
  const queryClient = useQueryClient15();
  const [courseId, setCourseId] = useState15("");
  const [lessonId, setLessonId] = useState15("");
  const [blueprintId, setBlueprintId] = useState15("");
  const courses = useQuery16({ queryKey: [...routeKey(route), "course"], queryFn: () => call(route, "course.list") });
  const lessons = useQuery16({ queryKey: [...routeKey(route), "lessons", courseId], queryFn: () => call(route, "lesson.list", { course_id: courseId }), enabled: !!courseId });
  const documents = useQuery16({ queryKey: [...routeKey(route), "documents", lessonId], queryFn: () => call(route, "document.list", { lesson_id: lessonId }), enabled: !!lessonId });
  const generations = useQuery16({
    queryKey: [...routeKey(route), "generations", lessonId],
    queryFn: () => call(route, "document.generation.list", { lesson_id: lessonId }),
    enabled: !!lessonId,
    refetchInterval: (query) => query.state.data?.items.some((item) => item.task.status === "running") ? 3e3 : false
  });
  const generationState = generations.data?.items.map((item) => `${item.workflow_id}:${item.task.version}`).join("|") ?? "";
  useEffect2(() => {
    if (lessonId) void queryClient.invalidateQueries({ queryKey: [...routeKey(route), "documents", lessonId] });
  }, [generationState, lessonId, queryClient, route]);
  const generate = useMutation16({
    mutationFn: async () => {
      const task = await call(route, "document.generation.begin", { lesson_id: lessonId, kind: "slide_blueprint", allow_model_call: true }, crypto.randomUUID());
      await queryClient.invalidateQueries({ queryKey: routeKey(route) });
      await openGeneration(route, task);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: routeKey(route) })
  });
  const reopen = useMutation16({ mutationFn: (generation) => openGeneration(route, generation) });
  function start(event) {
    event.preventDefault();
    generate.mutate();
  }
  return /* @__PURE__ */ jsxs16("section", { className: "space-y-5", "aria-label": "\u6559\u5B66\u8BFE\u4EF6\u9875\u9762\u89C4\u5212", children: [
    /* @__PURE__ */ jsx16("h2", { className: "text-lg font-semibold", children: "\u8BFE\u4EF6\u9875\u9762\u84DD\u56FE" }),
    /* @__PURE__ */ jsx16("p", { children: "\u6309\u6559\u6750\u3001\u5DF2\u5BA1\u6838\u6388\u8BFE\u7A3F\u4E0E\u6559\u6848\u89C4\u5212\u9010\u9875\u6559\u5B66\u5185\u5BB9\uFF0C\u53EF\u9009\u4E3B\u9898\u65E0\u9700\u4EBA\u5DE5\u53C2\u8003\u56FE\u3002" }),
    /* @__PURE__ */ jsxs16("label", { className: "grid max-w-xl gap-2", children: [
      "\u8BFE\u4EF6\u8BFE\u7A0B",
      /* @__PURE__ */ jsxs16("select", { "aria-label": "\u8BFE\u4EF6\u8BFE\u7A0B", value: courseId, onChange: (event) => {
        setCourseId(event.target.value);
        setLessonId("");
        setBlueprintId("");
      }, children: [
        /* @__PURE__ */ jsx16("option", { value: "", children: "\u9009\u62E9\u8BFE\u7A0B" }),
        courses.data?.items.map((course) => /* @__PURE__ */ jsx16("option", { value: course.id, children: course.title }, course.id))
      ] })
    ] }),
    courseId && /* @__PURE__ */ jsxs16("label", { className: "grid max-w-xl gap-2", children: [
      "\u8BFE\u4EF6\u8BFE\u6B21",
      /* @__PURE__ */ jsxs16("select", { "aria-label": "\u8BFE\u4EF6\u8BFE\u6B21", value: lessonId, onChange: (event) => {
        setLessonId(event.target.value);
        setBlueprintId("");
      }, children: [
        /* @__PURE__ */ jsx16("option", { value: "", children: "\u9009\u62E9\u8BFE\u6B21" }),
        lessons.data?.items.map((lesson) => /* @__PURE__ */ jsx16("option", { value: lesson.id, children: lesson.title }, lesson.id))
      ] })
    ] }),
    lessonId && /* @__PURE__ */ jsxs16(Fragment9, { children: [
      /* @__PURE__ */ jsxs16("form", { onSubmit: start, className: "grid max-w-xl gap-3", children: [
        /* @__PURE__ */ jsxs16("label", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx16("input", { type: "checkbox", required: true }),
          "\u5141\u8BB8\u672C\u6B21\u7531\u539F\u751FAgent\u89C4\u5212\u8BFE\u4EF6\uFF0C\u4F7F\u7528\u8BFE\u4EF6\u9636\u6BB5\u6A21\u578B\u6216\u5F53\u524D\u6A21\u578B\uFF0C\u53EF\u80FD\u4EA7\u751F\u8D39\u7528"
        ] }),
        /* @__PURE__ */ jsx16(Button16, { type: "submit", disabled: generate.isPending, children: "\u751F\u6210\u8BFE\u4EF6\u9875\u9762\u84DD\u56FE" })
      ] }),
      generations.data?.items.filter((item) => item.kind === "slide_blueprint").map((item) => /* @__PURE__ */ jsxs16("p", { children: [
        item.task.input.title,
        " ",
        /* @__PURE__ */ jsx16(Button16, { variant: "secondary", disabled: reopen.isPending, onClick: () => reopen.mutate(item), children: "\u6253\u5F00\u84DD\u56FEAgent\u4F1A\u8BDD" })
      ] }, item.workflow_id)),
      /* @__PURE__ */ jsxs16("label", { className: "grid max-w-xl gap-2", children: [
        "\u8BFE\u4EF6\u84DD\u56FE\u7248\u672C",
        /* @__PURE__ */ jsxs16("select", { "aria-label": "\u8BFE\u4EF6\u84DD\u56FE\u7248\u672C", value: blueprintId, onChange: (event) => setBlueprintId(event.target.value), children: [
          /* @__PURE__ */ jsx16("option", { value: "", children: "\u9009\u62E9\u9875\u9762\u84DD\u56FE" }),
          documents.data?.items.filter((document) => document.kind === "slide_blueprint").map((document) => /* @__PURE__ */ jsxs16("option", { value: document.id, children: [
            "\u9875\u9762\u84DD\u56FE \xB7 v",
            document.version,
            " \xB7 ",
            document.status === "approved" ? "\u5DF2\u5BA1\u6838" : "\u8349\u7A3F"
          ] }, document.id))
        ] })
      ] }),
      /* @__PURE__ */ jsx16(Button16, { variant: "secondary", onClick: () => queryClient.invalidateQueries({ queryKey: routeKey(route) }), children: "\u5237\u65B0\u8BFE\u4EF6\u8BB0\u5F55" }),
      blueprintId && /* @__PURE__ */ jsx16(BlueprintEditor, { route, documentId: blueprintId, onVersion: setBlueprintId }, blueprintId)
    ] }),
    [courses.error, lessons.error, documents.error, generations.error, generate.error, reopen.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx16("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/plugin.tsx
import { jsx as jsx17, jsxs as jsxs17 } from "react/jsx-runtime";
var PAGES = [
  ["course", "\u6211\u7684\u8BFE\u7A0B"],
  ["class", "\u73ED\u7EA7"],
  ["student", "\u5B66\u751F\u6863\u6848"],
  ["roster", "\u8BFE\u7A0B\u8EAB\u4EFD\u5173\u8054"],
  ["textbooks", "\u6559\u6750\u77E5\u8BC6\u5E93"],
  ["preparation", "\u6388\u8BFE\u7A3F\u4E0E\u6559\u6848"],
  ["slides", "\u8BFE\u4EF6\u9875\u9762\u84DD\u56FE"],
  ["tasks", "\u4EFB\u52A1\u4E0E\u5BA1\u6279"],
  ["settings", "\u6A21\u578B\u4E0E\u6743\u9650"]
];
function TeacherWorkspace() {
  const profile = useValue(host6.state.profile);
  const connectionId = useValue(host6.state.connectionId);
  const [page, setPage] = useState16("course");
  const routing = useQuery17({
    queryKey: ["teacher-route", connectionId, profile],
    queryFn: async () => {
      const routes = await host6.profileRoutes();
      const route2 = routes.find((item) => item.connectionId === connectionId && item.profile === profile);
      if (!route2) throw new Error("\u5F53\u524D\u6559\u5E08\u914D\u7F6E\u7684 Gateway \u8DEF\u7531\u5C1A\u672A\u5C31\u7EEA");
      return route2;
    }
  });
  const route = routing.data;
  return /* @__PURE__ */ jsxs17("main", { className: "h-full overflow-auto p-6 text-(--ui-text-primary)", "aria-label": "\u6559\u5E08\u4E13\u4E1A\u5DE5\u4F5C\u53F0", children: [
    /* @__PURE__ */ jsxs17("header", { className: "mb-6 space-y-2", children: [
      /* @__PURE__ */ jsx17("h1", { className: "text-2xl font-semibold", children: "\u6559\u5E08\u4E13\u4E1A\u5DE5\u4F5C\u53F0" }),
      /* @__PURE__ */ jsxs17("p", { children: [
        "\u5F53\u524D\u914D\u7F6E \xB7 ",
        profile,
        " \xB7 \u672C\u5730\u6559\u5B66\u6570\u636E\u4E0E Hermes \u4F1A\u8BDD\u5206\u5F00\u4FDD\u5B58"
      ] })
    ] }),
    /* @__PURE__ */ jsx17("nav", { className: "mb-6 flex flex-wrap gap-2", "aria-label": "\u6559\u5E08\u4E1A\u52A1\u5BFC\u822A", children: PAGES.map(([key, label]) => /* @__PURE__ */ jsx17(Button17, { variant: page === key ? "secondary" : "ghost", onClick: () => setPage(key), children: label }, key)) }),
    routing.isPending && /* @__PURE__ */ jsx17("p", { role: "status", children: "\u6B63\u5728\u8FDE\u63A5\u6559\u5E08\u914D\u7F6E\u2026" }),
    routing.error && /* @__PURE__ */ jsx17("p", { role: "alert", children: routing.error.message }),
    route && /* @__PURE__ */ jsxs17("div", { children: [
      ["course", "class", "student"].includes(page) && /* @__PURE__ */ jsx17(RecordEditor, { route, entity: page }),
      page === "roster" && /* @__PURE__ */ jsx17(CourseRoster, { route }),
      page === "tasks" && /* @__PURE__ */ jsx17(Tasks, { route }),
      page === "textbooks" && /* @__PURE__ */ jsx17(Textbooks, { route }),
      page === "preparation" && /* @__PURE__ */ jsx17(Preparation, { route }),
      page === "slides" && /* @__PURE__ */ jsx17(SlidesWorkspace, { route }),
      page === "settings" && /* @__PURE__ */ jsx17(Settings, { route })
    ] }, `${route.connectionId}:${route.profile}:${route.targetProfile}:${page}`)
  ] });
}
var plugin_default = {
  id: "teacher-assistant",
  name: "\u6559\u5E08\u4E13\u4E1A\u5DE5\u4F5C\u53F0",
  register(ctx) {
    ctx.registerMany([
      { id: "workspace", area: ROUTES_AREA, data: { path: "/teacher" }, render: () => /* @__PURE__ */ jsx17(TeacherWorkspace, {}) },
      { id: "navigation", area: SIDEBAR_NAV_AREA, data: { path: "/teacher", label: "\u6559\u5E08\u5DE5\u4F5C\u53F0", codicon: "mortar-board" } }
    ]);
  }
};
export {
  plugin_default as default
};
