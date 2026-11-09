// Generated from desktop/src by scripts/build_desktop.mjs.

// extensions/teacher-assistant/desktop/src/plugin.tsx
import { Button as Button4, host as host2, ROUTES_AREA, SIDEBAR_NAV_AREA, useQuery as useQuery4, useValue } from "@hermes/plugin-sdk";
import { useState as useState3 } from "react";

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
    mutation.mutate({ agent_student_access: form.has("student_access"), disabled_operations: form.getAll("disabled_operation").map(String), stage_models: stageModels });
  }
  return /* @__PURE__ */ jsxs2("section", { className: "space-y-5", "aria-label": "\u6A21\u578B\u4E0E\u6743\u9650\u8BBE\u7F6E", children: [
    /* @__PURE__ */ jsx2("h2", { className: "text-lg font-semibold", children: "\u6A21\u578B\u4E0E\u5DE5\u5177\u6743\u9650" }),
    /* @__PURE__ */ jsx2("p", { children: "\u51ED\u636E\u901A\u8FC7 Hermes \u7CFB\u7EDF\u8BBE\u7F6E\u7BA1\u7406\u3002\u6B64\u5904\u53EA\u4FDD\u5B58\u9636\u6BB5\u6A21\u578B\u540D\u79F0\u548C\u6743\u9650\u3002" }),
    settings.data && /* @__PURE__ */ jsxs2("form", { onSubmit: save, className: "max-w-3xl space-y-6", children: [
      /* @__PURE__ */ jsxs2("label", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx2("input", { type: "checkbox", name: "student_access", defaultChecked: settings.data.agent_student_access }),
        "\u5141\u8BB8 Agent \u8BBF\u95EE\u672C\u5730\u5B66\u751F\u8D44\u6599"
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
        task.status === "pending" && /* @__PURE__ */ jsx3(Button3, { disabled: mutation.isPending, onClick: () => mutation.mutate({ operation: "task.run", data: { id: task.id } }), children: "\u6267\u884C\u4EFB\u52A1" }),
        task.status === "failed" && /* @__PURE__ */ jsx3(Button3, { disabled: mutation.isPending, onClick: () => mutation.mutate({ operation: "task.retry", data: { id: task.id, version: task.version } }), children: "\u51C6\u5907\u91CD\u8BD5" }),
        task.status === "awaiting_review" && /* @__PURE__ */ jsxs3(Fragment, { children: [
          /* @__PURE__ */ jsx3(Button3, { disabled: mutation.isPending, onClick: () => mutation.mutate({ operation: "task.review", data: { id: task.id, version: task.version, decision: "approved" } }), children: "\u6559\u5E08\u6279\u51C6" }),
          /* @__PURE__ */ jsx3(Button3, { variant: "secondary", disabled: mutation.isPending, onClick: () => mutation.mutate({ operation: "task.review", data: { id: task.id, version: task.version, decision: "rejected" } }), children: "\u9000\u56DE\u4EFB\u52A1" })
        ] }),
        ["pending", "failed", "awaiting_review"].includes(task.status) && /* @__PURE__ */ jsx3(Button3, { variant: "secondary", disabled: mutation.isPending, onClick: () => mutation.mutate({ operation: "task.cancel", data: { id: task.id, version: task.version } }), children: "\u53D6\u6D88\u4EFB\u52A1" })
      ] })
    ] }, task.id)) }),
    [tasks.error, mutation.error].filter(Boolean).map((error, index) => /* @__PURE__ */ jsx3("p", { role: "alert", children: error?.message }, index))
  ] });
}

// extensions/teacher-assistant/desktop/src/plugin.tsx
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var PAGES = [
  ["course", "\u6211\u7684\u8BFE\u7A0B"],
  ["class", "\u73ED\u7EA7"],
  ["student", "\u5B66\u751F\u6863\u6848"],
  ["roster", "\u8BFE\u7A0B\u8EAB\u4EFD\u5173\u8054"],
  ["tasks", "\u4EFB\u52A1\u4E0E\u5BA1\u6279"],
  ["settings", "\u6A21\u578B\u4E0E\u6743\u9650"]
];
function TeacherWorkspace() {
  const profile = useValue(host2.state.profile);
  const connectionId = useValue(host2.state.connectionId);
  const [page, setPage] = useState3("course");
  const routing = useQuery4({
    queryKey: ["teacher-route", connectionId, profile],
    queryFn: async () => {
      const routes = await host2.profileRoutes();
      const route2 = routes.find((item) => item.connectionId === connectionId && item.profile === profile);
      if (!route2) throw new Error("\u5F53\u524D\u6559\u5E08\u914D\u7F6E\u7684 Gateway \u8DEF\u7531\u5C1A\u672A\u5C31\u7EEA");
      return route2;
    }
  });
  const route = routing.data;
  return /* @__PURE__ */ jsxs4("main", { className: "h-full overflow-auto p-6 text-(--ui-text-primary)", "aria-label": "\u6559\u5E08\u4E13\u4E1A\u5DE5\u4F5C\u53F0", children: [
    /* @__PURE__ */ jsxs4("header", { className: "mb-6 space-y-2", children: [
      /* @__PURE__ */ jsx4("h1", { className: "text-2xl font-semibold", children: "\u6559\u5E08\u4E13\u4E1A\u5DE5\u4F5C\u53F0" }),
      /* @__PURE__ */ jsxs4("p", { children: [
        "\u5F53\u524D\u914D\u7F6E \xB7 ",
        profile,
        " \xB7 \u672C\u5730\u6559\u5B66\u6570\u636E\u4E0E Hermes \u4F1A\u8BDD\u5206\u5F00\u4FDD\u5B58"
      ] })
    ] }),
    /* @__PURE__ */ jsx4("nav", { className: "mb-6 flex flex-wrap gap-2", "aria-label": "\u6559\u5E08\u4E1A\u52A1\u5BFC\u822A", children: PAGES.map(([key, label]) => /* @__PURE__ */ jsx4(Button4, { variant: page === key ? "secondary" : "ghost", onClick: () => setPage(key), children: label }, key)) }),
    routing.isPending && /* @__PURE__ */ jsx4("p", { role: "status", children: "\u6B63\u5728\u8FDE\u63A5\u6559\u5E08\u914D\u7F6E\u2026" }),
    routing.error && /* @__PURE__ */ jsx4("p", { role: "alert", children: routing.error.message }),
    route && /* @__PURE__ */ jsxs4("div", { children: [
      ["course", "class", "student"].includes(page) && /* @__PURE__ */ jsx4(RecordEditor, { route, entity: page }),
      page === "roster" && /* @__PURE__ */ jsx4(CourseRoster, { route }),
      page === "tasks" && /* @__PURE__ */ jsx4(Tasks, { route }),
      page === "settings" && /* @__PURE__ */ jsx4(Settings, { route })
    ] }, `${route.connectionId}:${route.profile}:${route.targetProfile}:${page}`)
  ] });
}
var plugin_default = {
  id: "teacher-assistant",
  name: "\u6559\u5E08\u4E13\u4E1A\u5DE5\u4F5C\u53F0",
  register(ctx) {
    ctx.registerMany([
      { id: "workspace", area: ROUTES_AREA, data: { path: "/teacher" }, render: () => /* @__PURE__ */ jsx4(TeacherWorkspace, {}) },
      { id: "navigation", area: SIDEBAR_NAV_AREA, data: { path: "/teacher", label: "\u6559\u5E08\u5DE5\u4F5C\u53F0", codicon: "mortar-board" } }
    ]);
  }
};
export {
  plugin_default as default
};
