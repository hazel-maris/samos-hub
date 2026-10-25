
/* =========================================================
   SAMOS TRIAGE v2.2
   Goals + Tasks + Brain Dump
   Minimal UI • Progressive Disclosure
   ========================================================= */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const refs = {
    thoughtForm: $("triage-form"),
    thoughtInput: $("triage-input"),
    thoughtList: $("triage-list"),
    goalForm: $("triage-goal-form"),
    goalInput: $("triage-goal-input"),
    goals: $("triage-goals"),
    message: $("triage-message")
  };

  let userId = null;
  let busy = false;

  // Expanded goals exist only in the current session.
  // All goals start collapsed on page load.
  const expandedGoals = new Set();

  function db() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      throw new Error("Supabase is not configured.");
    }
    return supabaseClient;
  }

  function el(tag, className = "", text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function btn(symbol, handler, className = "", label = symbol) {
    const node = el("button", className, symbol);
    node.type = "button";
    node.setAttribute("aria-label", label);
    node.title = label;
    node.addEventListener("click", handler);
    return node;
  }

  function status(text, error = false) {
    refs.message.textContent = text;
    refs.message.classList.toggle("error", error);
  }

  function setBusy(value) {
    busy = value;
    document.querySelectorAll(".triage-panel button").forEach(button => {
      button.disabled = value;
    });
  }

  async function mutate(action) {
    if (busy || !userId) return;

    setBusy(true);

    try {
      await action();
      status("");
      await load();
    } catch (error) {
      console.error("Triage update failed", error);
      status(error.message || String(error), true);
    } finally {
      setBusy(false);
    }
  }

  /* =========================================================
     DATA
     ========================================================= */

  async function load() {
    try {
      const { data: auth, error: authError } =
        await db().auth.getUser();

      if (authError) throw authError;

      userId = auth?.user?.id || null;

      if (!userId) {
        refs.goals.textContent = "Sign in from Settings.";
        refs.thoughtList.textContent = "Sign in from Settings.";
        return;
      }

      const results = await Promise.all([
        db().from("triage_items")
          .select("id,content,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),

        db().from("triage_goals")
          .select("id,title,priority,created_at")
          .eq("user_id", userId)
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true }),

        db().from("triage_tasks")
          .select("id,goal_id,title,sort_order,completed,created_at")
          .eq("user_id", userId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      ]);

      for (const result of results) {
        if (result.error) throw result.error;
      }

      renderThoughts(results[0].data || []);
      renderGoals(results[1].data || [], results[2].data || []);

    } catch (error) {
      console.error("Triage load failed", error);
      status(`Could not load Triage: ${error.message || error}`, true);
      refs.goals.textContent = "Unable to load goals.";
      refs.thoughtList.textContent = "Unable to load thoughts.";
    }
  }

  /* =========================================================
     BRAIN DUMP
     ========================================================= */

  function renderThoughts(items) {
    const scroll = refs.thoughtList.scrollTop;
    refs.thoughtList.replaceChildren();

    if (!items.length) {
      refs.thoughtList.append(
        el("p", "triage-empty", "All clear.")
      );
      return;
    }

    for (const item of items) {
      const row = el("div", "triage-row");
      const content = el("span", "", item.content);

      const remove = btn(
        "×",
        () => {
          if (!window.confirm("Remove this thought?")) return;

          mutate(async () => {
            const { error } = await db()
              .from("triage_items")
              .delete()
              .eq("id", item.id)
              .eq("user_id", userId);

            if (error) throw error;
          });
        },
        "triage-remove triage-icon-btn",
        `Remove thought: ${item.content}`
      );

      row.append(content, remove);
      refs.thoughtList.append(row);
    }

    refs.thoughtList.scrollTop = scroll;
  }

  /* =========================================================
     GOALS
     ========================================================= */

  function renderGoals(goals, tasks) {
    const scroll = refs.goals.scrollTop;
    refs.goals.replaceChildren();

    if (!goals.length) {
      refs.goals.append(
        el("p", "triage-empty", "No goals yet.")
      );
      return;
    }

    for (const goal of goals) {
      const ownedTasks = tasks.filter(
        task => task.goal_id === goal.id
      );

      const completed = ownedTasks.filter(
        task => task.completed
      ).length;

      const next = ownedTasks.find(
        task => !task.completed
      );

      const isExpanded = expandedGoals.has(goal.id);

      const card = el("article", "triage-goal-card");

      // GOAL HEADER
      const head = el("div", "triage-goal-head");
      const title = el("h3", "", goal.title);

      const progress = el(
        "p",
        "triage-progress",
        `${completed}/${ownedTasks.length} ✓`
      );

      const summary = el("div", "triage-goal-summary");
      summary.append(title, progress);

      const priority = el(
        "span",
        "triage-priority",
        ["", "Soon", "Normal", "Later"][goal.priority] || "Normal"
      );

      head.append(summary, priority);
      card.append(head);

      // NEXT TASK
      const focus = el("div", "triage-next");

      focus.append(
        el("div", "triage-eyebrow", "NEXT")
      );

      if (next) {
        focus.append(
          el("p", "triage-next-title", next.title)
        );

        const actions = el("div", "triage-next-actions");

        actions.append(
          btn(
            "✓",
            () => updateTask(next.id, { completed: true }),
            "triage-primary triage-icon-btn triage-complete-btn",
            `Complete: ${next.title}`
          )
        );

        focus.append(actions);
      } else {
        focus.append(
          el(
            "p",
            "triage-next-title",
            ownedTasks.length ? "All done! ✓" : "No tasks yet"
          )
        );
      }

      card.append(focus);

      // EXPAND / COLLAPSE
      const expand = btn(
        isExpanded ? "▴" : "▾",
        () => {
          if (expandedGoals.has(goal.id)) {
            expandedGoals.delete(goal.id);
          } else {
            expandedGoals.add(goal.id);
          }

          renderGoals(goals, tasks);
        },
        "triage-expand triage-icon-btn",
        isExpanded
          ? `Hide tasks for ${goal.title}`
          : `Show tasks for ${goal.title}`
      );

      expand.setAttribute("aria-expanded", String(isExpanded));
      card.append(expand);

      // DETAILS — HIDDEN BY DEFAULT
      if (isExpanded) {
        const details = el("div", "triage-details");

        for (const task of ownedTasks) {
          const row = el("div", "triage-task-row");
          const label = el("label", "triage-check-label");

          const check = document.createElement("input");
          check.type = "checkbox";
          check.checked = task.completed;
          check.addEventListener("change", () => {
            updateTask(task.id, { completed: check.checked });
          });

          const taskText = el(
            "span",
            task.completed ? "triage-done" : "",
            task.title
          );

          label.append(check, taskText);

          const actions = el("div", "triage-task-actions");

          // EDIT TASK
          actions.append(
            btn(
              "✎",
              () => {
                const title = window.prompt(
                  "Edit task",
                  task.title
                );

                if (
                  title === null ||
                  !title.trim() ||
                  title.trim() === task.title
                ) return;

                updateTask(task.id, { title: title.trim() });
              },
              "triage-icon-btn",
              `Edit task: ${task.title}`
            )
          );

          // REMOVE TASK
          actions.append(
            btn(
              "×",
              () => {
                if (!window.confirm("Remove this task?")) return;

                mutate(async () => {
                  const { error } = await db()
                    .from("triage_tasks")
                    .delete()
                    .eq("id", task.id)
                    .eq("user_id", userId);

                  if (error) throw error;
                });
              },
              "triage-remove triage-icon-btn",
              `Remove task: ${task.title}`
            )
          );

          row.append(label, actions);
          details.append(row);
        }

        // ADD TASK
        const addTaskForm = el(
          "form",
          "triage-form triage-task-form"
        );

        const taskInput = document.createElement("input");
        taskInput.type = "text";
        taskInput.maxLength = 500;
        taskInput.placeholder = "Next task";
        taskInput.required = true;
        taskInput.setAttribute(
          "aria-label",
          `New task for ${goal.title}`
        );

        const submit = el(
          "button",
          "triage-icon-btn triage-add-task",
          "+"
        );

        submit.type = "submit";
        submit.title = "Add task";
        submit.setAttribute("aria-label", "Add task");

        addTaskForm.append(taskInput, submit);

        addTaskForm.addEventListener("submit", event => {
          event.preventDefault();

          const value = taskInput.value.trim();
          if (!value) return;

          mutate(async () => {
            const nextOrder = ownedTasks.reduce(
              (max, task) => Math.max(max, task.sort_order ?? 0),
              -1
            ) + 1;

            const { error } = await db()
              .from("triage_tasks")
              .insert({
                user_id: userId,
                goal_id: goal.id,
                title: value,
                sort_order: nextOrder
              });

            if (error) throw error;
          });
        });

        details.append(addTaskForm);

        // GOAL ACTIONS
        const goalActions = el("div", "triage-goal-actions");

        // EDIT GOAL
        goalActions.append(
          btn(
            "✎",
            () => {
              const title = window.prompt(
                "Edit goal",
                goal.title
              );

              if (
                title === null ||
                !title.trim() ||
                title.trim() === goal.title
              ) return;

              mutate(async () => {
                const { error } = await db()
                  .from("triage_goals")
                  .update({ title: title.trim() })
                  .eq("id", goal.id)
                  .eq("user_id", userId);

                if (error) throw error;
              });
            },
            "triage-icon-btn",
            `Edit goal: ${goal.title}`
          )
        );

        // PRIORITY
        goalActions.append(
          btn(
            "⚑",
            () => {
              const entered = window.prompt(
                "Priority: 1 = Soon, 2 = Normal, 3 = Later",
                String(goal.priority)
              );

              if (entered === null) return;

              const value = Number(entered);

              if (![1, 2, 3].includes(value)) {
                status("Choose 1, 2, or 3.", true);
                return;
              }

              mutate(async () => {
                const { error } = await db()
                  .from("triage_goals")
                  .update({ priority: value })
                  .eq("id", goal.id)
                  .eq("user_id", userId);

                if (error) throw error;
              });
            },
            "triage-icon-btn",
            `Priority for ${goal.title}`
          )
        );

        // DELETE GOAL
        goalActions.append(
          btn(
            "×",
            () => {
              if (!window.confirm(
                `Delete "${goal.title}" and all its tasks? This cannot be undone.`
              )) return;

              mutate(async () => {
                const { error } = await db()
                  .from("triage_goals")
                  .delete()
                  .eq("id", goal.id)
                  .eq("user_id", userId);

                if (error) throw error;
              });
            },
            "triage-remove triage-icon-btn",
            `Delete goal: ${goal.title}`
          )
        );

        details.append(goalActions);
        card.append(details);
      }

      refs.goals.append(card);
    }

    refs.goals.scrollTop = scroll;
  }

  /* =========================================================
     TASK UPDATES
     ========================================================= */

  function updateTask(id, fields) {
    mutate(async () => {
      const { error } = await db()
        .from("triage_tasks")
        .update(fields)
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
    });
  }

  /* =========================================================
     FORM HANDLERS
     ========================================================= */

  refs.thoughtForm.addEventListener("submit", event => {
    event.preventDefault();

    const content = refs.thoughtInput.value.trim();
    if (!content) return;

    mutate(async () => {
      const { error } = await db()
        .from("triage_items")
        .insert({ user_id: userId, content });

      if (error) throw error;

      refs.thoughtInput.value = "";
    });
  });

  refs.goalForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = refs.goalInput.value.trim();
    if (!title) return;

    mutate(async () => {
      const { error } = await db()
        .from("triage_goals")
        .insert({ user_id: userId, title });

      if (error) throw error;

      refs.goalInput.value = "";
    });
  });

  // INITIALIZE
  load();
})();
