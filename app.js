(() => {
  const GUIDE = window.GUIDE;
  if (!GUIDE) {
    document.body.innerHTML = "<p style='padding:2rem'>Curriculum data failed to load.</p>";
    return;
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const escape = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const textOf = (node) => {
    if (node == null) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(textOf).join(" ");
    if (typeof node === "object") return Object.values(node).map(textOf).join(" ");
    return "";
  };

  const pages = [];

  const addPage = (id, title, kicker, html, searchExtra = "", listed = true) => {
    pages.push({
      id,
      title,
      kicker,
      html,
      listed,
      search: `${title} ${kicker} ${searchExtra} ${html.replace(/<[^>]+>/g, " ")}`.toLowerCase(),
    });
  };

  const tableHTML = (table) => {
    if (!table || !table.headers) return "";
    const head = table.headers.map((h) => `<th>${escape(h)}</th>`).join("");
    const body = table.rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell, i) => {
              const v = escape(cell);
              return i === 0 && /^[0-9A-Z.]{3,}$/.test(cell)
                ? `<td><span class="std">${v}</span></td>`
                : `<td>${v}</td>`;
            })
            .join("")}</tr>`
      )
      .join("");
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  const listHTML = (items, ordered = false) => {
    if (!items || !items.length) return "";
    const tag = ordered ? "ol" : "ul";
    return `<${tag}>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</${tag}>`;
  };

  const metaHTML = (meta) => {
    if (!meta || !Object.keys(meta).length) return "";
    return `<dl class="meta-list">${Object.entries(meta)
      .map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`)
      .join("")}</dl>`;
  };

  const videosHTML = (items) => {
    if (!items || !items.length) return "";
    return `<ul class="videos">${items
      .map(
        (v) => `<li>
        <time>${escape(v.duration || "")}</time>
        <div>
          <a href="${escape(v.url)}" target="_blank" rel="noopener noreferrer">${escape(v.title)}</a>
          <small>${escape([v.source, v.note].filter(Boolean).join(" — "))}</small>
        </div>
      </li>`
      )
      .join("")}</ul>`;
  };

  const sectionHTML = (section, prefix = "") => {
    const id = prefix ? `${prefix}-${section.key}` : section.key;
    const title = `<h2 id="${escape(id)}">${escape(section.title)}</h2>`;
    switch (section.key) {
      case "overview":
      case "assessmentPhilosophy":
        return `${title}<p>${escape(section.prose)}</p>`;
      case "questions":
        return `${title}${listHTML(section.items)}`;
      case "standards":
        return `${title}${tableHTML({
          headers: ["Standard", "Description"],
          rows: (section.standards || []).map((s) => [s.code, s.text]),
        })}`;
      case "objectives":
        return `${title}${section.lead ? `<p>${escape(section.lead)}</p>` : ""}${listHTML(section.items, true)}`;
      case "videos":
        return `${title}<p>Preview every clip before class. Use as a hook, a flipped note, or review — not as the lesson.</p>${videosHTML(section.items)}`;
      case "project":
        return `${title}${(section.projects || [])
          .map(
            (p) => `<article class="project">
              <h3>${escape(p.title)}</h3>
              <p>${escape(p.prose)}</p>
              ${metaHTML(p.meta)}
            </article>`
          )
          .join("")}`;
      case "sequence": {
        const hasNotes = (section.rows || []).some((r) => r.note);
        return `${title}${tableHTML({
          headers: hasNotes
            ? ["Days", "Topic", "Skills & concepts", "In the room"]
            : ["Days", "Topic", "Skills & concepts", "Activities"],
          rows: (section.rows || []).map((r) =>
            hasNotes
              ? [r.days, r.topic, r.skills, r.note || r.activities]
              : [r.days, r.topic, r.skills, r.activities]
          ),
        })}`;
      }
      case "vocabulary":
        return `${title}${tableHTML({
          headers: ["Term", "Definition"],
          rows: (section.terms || []).map((t) => [t.term, t.definition]),
        })}`;
      case "differentiation":
      case "connections":
      case "tech":
        return `${title}${section.lead ? `<p>${escape(section.lead)}</p>` : ""}${listHTML(section.items)}`;
      case "structure":
        return `${title}<p>${escape(section.prose)}</p>${tableHTML(section.table)}`;
      case "crossDomain":
        return `${title}${section.lead ? `<p>${escape(section.lead)}</p>` : ""}${tableHTML(section.table)}`;
      case "rubric":
      case "grading":
      case "formative":
        return `${title}${tableHTML(section.table)}`;
      default:
        return `${title}${section.prose ? `<p>${escape(section.prose)}</p>` : ""}`;
    }
  };

  const unitTOC = (unit) =>
    `<ul class="toc">${unit.sections
      .map((s) => `<li><a href="#unit-${unit.id}/${s.key}">${escape(prettySection(s))}</a></li>`)
      .join("")}</ul>`;

  function prettySection(section) {
    const map = {
      overview: "Overview",
      questions: "Questions",
      standards: "Standards",
      objectives: "Objectives",
      videos: "Videos",
      project: "Project",
      sequence: "Sequence",
      vocabulary: "Vocabulary",
      differentiation: "Access",
      connections: "Connections",
      tech: "Tools",
      rubric: "Rubric",
      grading: "Grading",
      structure: "Structure",
      crossDomain: "Cross-domain",
      assessmentPhilosophy: "Assessment",
      formative: "Formative",
    };
    return map[section.key] || section.title;
  }

  const course = GUIDE.course;
  const units = GUIDE.units;
  const LESSONS = window.LESSONS || { models: [], sequences: {}, weekly: { rows: [] }, template: [] };

  units.forEach((u) => {
    const seq = u.sections.find((s) => s.key === "sequence");
    const extra = (LESSONS.sequences && LESSONS.sequences[String(u.id)]) || [];
    if (!seq) return;
    seq.rows.forEach((row) => {
      const key = String(row.days).replace(/-/g, "–");
      const hit = extra.find((n) => String(n.days).replace(/-/g, "–") === key);
      if (hit) row.note = hit.note;
    });
  });

  const modelLessons = LESSONS.models || [];
  const standardCount = units.reduce((n, u) => {
    const s = u.sections.find((x) => x.key === "standards");
    return n + (s ? s.standards.length : 0);
  }, 0);
  const projectCount = units.reduce((n, u) => {
    const s = u.sections.find((x) => x.key === "project");
    return n + (s && s.projects ? s.projects.length : 0);
  }, 0);
  const lessonCount = units.reduce((n, u) => n + u.days, 0);

  addPage(
    "overview",
    course.title,
    course.subtitle,
    `
      <p class="kicker">${escape(course.alignment)} · ${escape(course.span)}</p>
      <h1>${escape(course.title)}</h1>
      <p class="lede">A year of 8th-grade mathematics designed so students can explain a number, write an equation, read a graph, and defend a method — then use those habits on a problem they chose themselves.</p>
      <div class="stats">
        <div class="stat"><b>${units.length}</b><span>Units</span></div>
        <div class="stat"><b>${lessonCount}</b><span>Lessons</span></div>
        <div class="stat"><b>${projectCount}</b><span>Projects</span></div>
        <div class="stat"><b>${standardCount}</b><span>Standards</span></div>
      </div>
      <section>
        <h2>Design</h2>
        <div class="principles">
          ${course.principles
            .map((p) => `<div><h3>${escape(p.title)}</h3><p>${escape(p.text)}</p></div>`)
            .join("")}
        </div>
      </section>
      <section>
        <h2>What this guide holds</h2>
        <div class="split">
          ${course.audience
            .map((a) => `<div><h3>${escape(a.title)}</h3>${listHTML(a.items)}</div>`)
            .join("")}
        </div>
        <p class="note">${escape(course.howToRead.text)}</p>
      </section>
      <section>
        <h2>How to use it</h2>
        ${listHTML(course.implementation)}
      </section>
    `
  );

  addPage(
    "year",
    "Year at a glance",
    "Pacing",
    `
      <p class="kicker">100 instructional days</p>
      <h1>Year at a glance</h1>
      <p class="lede">The year is 100 lessons. Time is given to the major work of the grade, then spent again where those ideas have to travel — functions after equations, data after slope, a capstone after everything.</p>
      ${tableHTML({
        headers: ["Unit", "Window", "Days", "Why this placement"],
        rows: course.pacing.map((p) => {
          const unit = units.find((u) => u.id === p.unit);
          return [`${p.unit}. ${unit.title}`, p.window, String(p.days), p.why];
        }),
      })}
      <section>
        <h2>The year as one argument</h2>
        <p>Unit 1 builds the number system later geometry and science will need. Unit 2 makes slope a number you can write. Unit 3 makes that number a function. Unit 4 asks whether a movement, a proof, or a volume can be trusted. Unit 5 uses slope again, this time as a claim about data. Unit 6 asks students to choose a question and pick the tool.</p>
      </section>
    `
  );

  addPage(
    "lesson",
    "Lessons",
    "Architecture",
    `
      <p class="kicker">${escape(course.lesson.length)} · 100 days · one shape</p>
      <h1>Lessons</h1>
      <p class="lede">${escape(course.lesson.note)} The pages below take that shape and write it out for ten days from the bundle — not every lesson of the year, the ones that show how a day actually runs.</p>
      <section>
        <h2>The daily shape</h2>
        ${tableHTML({
          headers: ["Part", "Time", "Purpose"],
          rows: course.lesson.parts.map((p) => [p.name, p.minutes, p.text]),
        })}
      </section>
      <section>
        <h2>How a lesson is written</h2>
        <p>Every model lesson below uses the same header and the same five moves. Teachers can copy the skeleton onto any other day in the sequence.</p>
        ${tableHTML({
          headers: ["Piece", "What belongs here"],
          rows: (LESSONS.template || []).map((t) => [t.name, t.text]),
        })}
      </section>
      <section>
        <h2>The week around the lesson</h2>
        <p>${escape((LESSONS.weekly && LESSONS.weekly.note) || "")}</p>
        ${tableHTML({
          headers: ["When", "What happens"],
          rows: (LESSONS.weekly && LESSONS.weekly.rows) || [],
        })}
      </section>
      <section>
        <h2>Ten lessons from the bundle</h2>
        <p>Each write-up is a full period: the prompt, the task, the discussion, the exit ticket, the likely mistake, and how to support or stretch. Open one, then steal the skeleton for the next day in that unit.</p>
        <div class="lesson-index">
          ${modelLessons
            .map((m) => {
              const unit = units.find((u) => u.id === m.unit);
              return `<a href="#lesson-${m.id}">
                <small>Unit ${m.unit} · Day ${escape(m.days)} · ${escape((unit && unit.title) || "")}</small>
                <strong>${escape(m.title)}</strong>
                <span>${escape(m.objective)}</span>
              </a>`;
            })
            .join("")}
        </div>
      </section>
    `,
    modelLessons.map((m) => `${m.title} ${m.objective} ${m.standards.join(" ")}`).join(" ")
  );

  const phaseHTML = (lesson) => {
    const phases = [
      ["Retrieve", lesson.retrieve],
      ["Launch", lesson.launch],
      ["Explore", lesson.explore],
      ["Discuss", lesson.discuss],
      ["Check", lesson.check],
    ];
    return phases
      .map(
        ([name, text]) => `<section class="phase">
          <h2>${name}</h2>
          <p>${escape(text)}</p>
        </section>`
      )
      .join("");
  };

  modelLessons.forEach((m) => {
    const unit = units.find((u) => u.id === m.unit);
    addPage(
      `lesson-${m.id}`,
      m.title,
      `Unit ${m.unit} · Day ${m.days}`,
      `
        <p class="kicker">Unit ${m.unit} · Day ${escape(m.days)} · ${escape((unit && unit.title) || "")}</p>
        <h1>${escape(m.title)}</h1>
        <p class="lede">${escape(m.objective)}</p>
        ${metaHTML({
          Standards: (m.standards || []).join(", "),
          Materials: (m.materials || []).join("; "),
        })}
        ${phaseHTML(m)}
        <section>
          <h2>The mistake to expect</h2>
          <p>${escape(m.misconception)}</p>
        </section>
        <section>
          <h2>Access</h2>
          <div class="split">
            <div><h3>Support</h3><p>${escape(m.support)}</p></div>
            <div><h3>Extend</h3><p>${escape(m.extend)}</p></div>
          </div>
        </section>
      `,
      `${m.title} ${m.objective} ${(m.standards || []).join(" ")} ${m.retrieve} ${m.launch} ${m.explore}`,
      false
    );
  });

  addPage(
    "practices",
    "Mathematical practices",
    "Habits",
    `
      <p class="kicker">Standards for Mathematical Practice</p>
      <h1>How the practices show up</h1>
      <p class="lede">The eight practices are not a poster. Each one has a job in this course — a project, a discussion move, or a written requirement that makes the habit visible.</p>
      ${course.practices
        .map(
          (p) => `<section>
            <h2>${escape(p.code)} · ${escape(p.title)}</h2>
            <p>${escape(p.text)}</p>
          </section>`
        )
        .join("")}
    `
  );

  addPage(
    "assessment",
    "Assessment",
    "Evidence",
    `
      <p class="kicker">Formative and summative</p>
      <h1>Assessment</h1>
      <p class="lede">${escape(course.assessment.philosophy)}</p>
      <section>
        <h2>Grade weights</h2>
        ${tableHTML({
          headers: ["Component", "Weight", "Notes"],
          rows: course.assessment.weights.map((w) => [w.name, w.weight, w.note]),
        })}
      </section>
      <section>
        <h2>Retake</h2>
        <p>${escape(course.assessment.retake)}</p>
      </section>
      <section>
        <h2>Shared project rubric</h2>
        <p>Every STAR project uses the same four categories. The rubric is public on day one of the project.</p>
        ${(() => {
          const rubric = units
            .flatMap((u) => u.sections)
            .find((s) => s.key === "rubric");
          return rubric ? tableHTML(rubric.table) : "";
        })()}
      </section>
      <section>
        <h2>Formative routines</h2>
        ${(() => {
          const form = units
            .flatMap((u) => u.sections)
            .find((s) => s.key === "formative");
          return form ? tableHTML(form.table) : "";
        })()}
      </section>
    `
  );

  const allProjects = units.flatMap((u) => {
    const s = u.sections.find((x) => x.key === "project");
    return (s?.projects || []).map((p) => ({ unit: u, project: p }));
  });

  addPage(
    "projects",
    "STAR projects",
    "Performance",
    `
      <p class="kicker">Seven performances across the year</p>
      <h1>STAR projects</h1>
      <p class="lede">Projects are not decoration at the end of a unit. They are the place students have to choose a representation, show the work, and answer a question from someone else.</p>
      ${allProjects
        .map(
          ({ unit, project }) => `<section>
            <h2>Unit ${unit.id} · ${escape(project.title)}</h2>
            <p>${escape(project.prose)}</p>
            ${metaHTML(project.meta)}
          </section>`
        )
        .join("")}
    `
  );

  addPage(
    "access",
    "Access",
    "Differentiation",
    `
      <p class="kicker">Support and extension</p>
      <h1>Access</h1>
      <p class="lede">${escape(course.differentiation.text)}</p>
      <div class="principles">
        ${course.differentiation.moves
          .map((m) => `<div><h3>${escape(m.title)}</h3><p>${escape(m.text)}</p></div>`)
          .join("")}
      </div>
      ${units
        .map((u) => {
          const s = u.sections.find((x) => x.key === "differentiation");
          if (!s) return "";
          return `<section>
            <h2>Unit ${u.id} · ${escape(u.title)}</h2>
            ${s.lead ? `<p>${escape(s.lead)}</p>` : ""}
            ${listHTML(s.items)}
          </section>`;
        })
        .join("")}
    `
  );

  addPage(
    "resources",
    "Resources",
    "Tools",
    `
      <p class="kicker">External</p>
      <h1>Resources</h1>
      <p class="lede">A short list. Every link is free and works on a Chromebook. Videos live with their units; these are the tools used more than once.</p>
      <ul class="resources">
        ${course.resources
          .map(
            (r) => `<li>
              <a href="${escape(r.url)}" target="_blank" rel="noopener noreferrer">${escape(r.name)}</a>
              <p>${escape(r.note)}</p>
            </li>`
          )
          .join("")}
      </ul>
    `
  );

  const standardsRows = [];
  units.forEach((u) => {
    const s = u.sections.find((x) => x.key === "standards");
    (s?.standards || []).forEach((st) => {
      standardsRows.push({
        code: st.code,
        text: st.text,
        unit: `Unit ${u.id}`,
        href: `#unit-${u.id}/standards`,
      });
    });
  });

  addPage(
    "standards",
    "Standards index",
    "CCSS",
    `
      <p class="kicker">${standardsRows.length} grade-8 standards</p>
      <h1>Standards index</h1>
      <p class="lede">Every standard in this course, in teaching order, with the unit that owns it. Click a code to open that unit’s standards table.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Standard</th><th>Unit</th><th>Description</th></tr></thead>
        <tbody>
          ${standardsRows
            .map(
              (r) => `<tr>
                <td><a class="std" href="${r.href}">${escape(r.code)}</a></td>
                <td class="nowrap">${escape(r.unit)}</td>
                <td>${escape(r.text)}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table></div>
    `,
    standardsRows.map((r) => r.code).join(" ")
  );

  const terms = [];
  units.forEach((u) => {
    const s = u.sections.find((x) => x.key === "vocabulary");
    (s?.terms || []).forEach((t) => terms.push({ ...t, unit: `Unit ${u.id}` }));
  });
  terms.sort((a, b) => a.term.localeCompare(b.term));

  addPage(
    "glossary",
    "Glossary",
    "Language",
    `
      <p class="kicker">${terms.length} terms</p>
      <h1>Glossary</h1>
      <p class="lede">The academic language of the year, collected from the six units. Teach the words with the idea, not as a list to copy.</p>
      ${tableHTML({
        headers: ["Term", "Unit", "Definition"],
        rows: terms.map((t) => [t.term, t.unit, t.definition]),
      })}
    `,
    terms.map((t) => t.term).join(" ")
  );

  units.forEach((unit) => {
    const modelsHere = modelLessons.filter((m) => m.unit === unit.id);
    const modelBlock = modelsHere.length
      ? `<section>
          <h2>Model lessons</h2>
          <p>Full write-ups from this unit, using the daily shape.</p>
          <ul>${modelsHere
            .map((m) => `<li><a href="#lesson-${m.id}">Day ${escape(m.days)} — ${escape(m.title)}</a></li>`)
            .join("")}</ul>
        </section>`
      : "";
    const html = `
      <p class="kicker">Unit ${unit.id} · ${escape(unit.days)} lessons · ${escape(unit.domain)}</p>
      <h1>${escape(unit.title)}</h1>
      <p class="lede">${escape(unit.focus)}</p>
      ${unitTOC(unit)}
      ${unit.sections.map((s) => sectionHTML(s, `u${unit.id}`)).join("")}
      ${modelBlock}
    `;
    addPage(
      `unit-${unit.id}`,
      unit.title,
      `Unit ${unit.id}`,
      html,
      `${unit.domain} ${unit.focus} ${textOf(unit.sections)}`
    );
  });

  addPage(
    "search",
    "Search",
    "Find",
    `<p class="kicker">Index</p><h1>Search</h1><div id="search-results"></div>`
  );

  /* ——— Render shell ——— */
  const navFront = [
    ["overview", "Overview"],
    ["year", "Year at a glance"],
    ["lesson", "Lessons"],
    ["practices", "Practices"],
    ["assessment", "Assessment"],
    ["projects", "Projects"],
    ["access", "Access"],
    ["resources", "Resources"],
    ["standards", "Standards"],
    ["glossary", "Glossary"],
  ];

  const sidebar = $("#sidebar");
  sidebar.innerHTML = `
    <div class="nav-label">Guide</div>
    ${navFront
      .map(([id, label]) => `<a href="#${id}" data-page="${id}">${escape(label)}</a>`)
      .join("")}
    <div class="nav-label">Units</div>
    ${units
      .map(
        (u) =>
          `<a class="unit-link" href="#unit-${u.id}" data-page="unit-${u.id}"><em>${u.id}</em><span>${escape(u.title)}</span></a>`
      )
      .join("")}
  `;

  const main = $("#main");
  main.innerHTML = pages
    .map(
      (p) =>
        `<article class="page" id="page-${p.id}" data-page="${p.id}">
          ${p.html}
          <nav class="page-nav" aria-label="Adjacent pages"></nav>
        </article>`
    )
    .join("");

  const listed = pages.filter((p) => p.listed !== false && p.id !== "search");
  pages.forEach((p) => {
    const nav = $(`#page-${p.id} .page-nav`);
    if (!nav || p.id === "search") {
      if (nav) nav.remove();
      return;
    }
    if (p.id.startsWith("lesson-")) {
      const i = modelLessons.findIndex((m) => `lesson-${m.id}` === p.id);
      const prev = modelLessons[i - 1];
      const next = modelLessons[i + 1];
      nav.innerHTML = `
        ${prev ? `<a href="#lesson-${prev.id}"><span>Previous lesson</span>${escape(prev.title)}</a>` : `<a href="#lesson"><span>Lessons</span>The daily shape</a>`}
        ${next ? `<a href="#lesson-${next.id}"><span>Next lesson</span>${escape(next.title)}</a>` : `<a href="#lesson"><span>Lessons</span>All ten write-ups</a>`}
      `;
      return;
    }
    const i = listed.findIndex((x) => x.id === p.id);
    const prev = listed[i - 1];
    const next = listed[i + 1];
    nav.innerHTML = `
      ${prev ? `<a href="#${prev.id}"><span>Previous</span>${escape(prev.title)}</a>` : "<span></span>"}
      ${next ? `<a href="#${next.id}"><span>Next</span>${escape(next.title)}</a>` : ""}
    `;
  });

  /* ——— Routing ——— */
  const parseHash = () => {
    const raw = (location.hash || "#overview").replace(/^#/, "");
    const [page, section] = raw.split("/");
    return { page: page || "overview", section };
  };

  const setTitle = (page) => {
    const p = pages.find((x) => x.id === page);
    document.title = p
      ? `${p.title} — ${course.title}`
      : `${course.title} — ${course.subtitle}`;
  };

  const showPage = (pageId, section) => {
    const exists = pages.some((p) => p.id === pageId);
    const id = exists ? pageId : "overview";
    $$(".page").forEach((el) => {
      const on = el.dataset.page === id;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
    $$("#sidebar a").forEach((a) => {
      const on = a.dataset.page === id;
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    setTitle(id);
    try {
      localStorage.setItem("guide:last", id);
    } catch (_) {
      /* ignore */
    }
    closeNav();
    const pageEl = $(`#page-${id}`);
    if (section && pageEl) {
      const candidates = [section, id.startsWith("unit-") ? `u${id.slice(5)}-${section}` : ""].filter(Boolean);
      const target = candidates
        .map((name) => pageEl.querySelector(`#${CSS.escape(name)}`))
        .find(Boolean);
      if (target) {
        target.scrollIntoView({ block: "start" });
        return;
      }
    }
    window.scrollTo(0, 0);
  };

  const route = () => {
    const { page, section } = parseHash();
    if (page === "search") {
      const q = decodeURIComponent(section || "");
      showPage("search");
      if ($("#search-input") && $("#search-input").value !== q) {
        $("#search-input").value = q;
      }
      renderSearch(q);
      return;
    }
    showPage(page, section);
  };

  /* ——— Search ——— */
  const renderSearch = (query) => {
    const q = (query || "").trim();
    const box = $("#search-results");
    if (!box) return;
    $("#search-input").value = q;
    if (!q) {
      box.innerHTML = `<p class="empty">Type a standard, a term, a project, or a word from a lesson.</p>`;
      return;
    }
    const needles = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = pages
      .filter((p) => p.id !== "search")
      .map((p) => {
        const score = needles.reduce((n, word) => n + (p.search.includes(word) ? 1 : 0), 0);
        return { p, score };
      })
      .filter((h) => h.score === needles.length);

    if (!hits.length) {
      box.innerHTML = `<p class="empty">No matches for “${escape(q)}”.</p>`;
      return;
    }

    const snippet = (text) => {
      const lower = text.toLowerCase();
      const idx = lower.indexOf(needles[0]);
      const start = Math.max(0, idx - 70);
      const raw = text.slice(start, start + 180).replace(/\s+/g, " ");
      let html = escape((start > 0 ? "…" : "") + raw + "…");
      needles.forEach((word) => {
        html = html.replace(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"), "<mark>$1</mark>");
      });
      return html;
    };

    box.innerHTML = hits
      .map(({ p }) => {
        const plain = p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        return `<div class="result">
          <a href="#${p.id}">${escape(p.kicker ? p.kicker + " · " : "")}${escape(p.title)}</a>
          <p>${snippet(plain)}</p>
        </div>`;
      })
      .join("");
  };

  let searchTimer = 0;
  const onSearchInput = (event) => {
    const q = event.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const next = q.trim() ? "search/" + encodeURIComponent(q.trim()) : "overview";
      if ((location.hash || "#").replace(/^#/, "") !== next) {
        location.hash = next;
      } else {
        showPage("search");
        renderSearch(q);
      }
    }, 120);
  };

  /* ——— Chrome ——— */
  const closeNav = () => {
    document.body.classList.remove("nav-open");
    const btn = $("#menu-btn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  };

  $("#menu-btn")?.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    $("#menu-btn").setAttribute("aria-expanded", String(open));
  });
  $(".backdrop")?.addEventListener("click", closeNav);

  $("#search-input")?.addEventListener("input", onSearchInput);
  $("#print-btn")?.addEventListener("click", () => window.print());

  document.addEventListener("keydown", (event) => {
    const inField = /^(INPUT|TEXTAREA)$/.test(event.target.tagName);
    if (event.key === "/" && !inField) {
      event.preventDefault();
      $("#search-input")?.focus();
      $("#search-input")?.select();
    }
    if (event.key === "Escape") {
      closeNav();
      if (document.activeElement === $("#search-input")) {
        $("#search-input").blur();
        if (parseHash().page === "search") location.hash = "overview";
      }
    }
  });

  window.addEventListener("hashchange", route);

  if (!location.hash) {
    let last = "overview";
    try {
      last = localStorage.getItem("guide:last") || "overview";
    } catch (_) {
      /* ignore */
    }
    location.replace("#" + last);
  } else {
    route();
  }
})();
