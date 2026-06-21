"use client";

import courses from "../data/courses.json";
import { useMemo, useState } from "react";

type Course = {
  id: string;
  code: string;
  name: string;
  credits: number;
  difficulty: number;
  difficultySource: "student" | "estimated";
  reviewCount: number;
  rating: number | null;
  averageGrade: string | null;
  subject: string;
  type: string;
  faculty: string;
  department: string;
  termAvailability: string[];
  prerequisites: string[];
  corequisites: string[];
  prerequisitesText: string | null;
  corequisitesText: string | null;
  restrictions: string | null;
  description: string;
  url: string;
  hasLab: boolean;
};

type ResultLevel = "light" | "balanced" | "heavy" | "risky";
type TermName = "Fall" | "Winter" | "Summer";
type TermPlan = {
  term: TermName;
  courses: Course[];
  credits: number;
  workload: number;
  resultLevel: ResultLevel;
};
type PlanWarning = {
  course: Course;
  message: string;
};

const typedCourses = courses as Course[];
const planningTerms: TermName[] = ["Fall", "Winter", "Summer"];

const levelStyles: Record<ResultLevel, string> = {
  light: "border-teal/30 bg-teal/10 text-teal",
  balanced: "border-moss/30 bg-moss/10 text-moss",
  heavy: "border-clay/30 bg-clay/10 text-clay",
  risky: "border-red-500/30 bg-red-50 text-red-700",
};

const levelCopy: Record<ResultLevel, string> = {
  light: "Light semester",
  balanced: "Balanced semester",
  heavy: "Heavy semester",
  risky: "Risky semester",
};

const termOptions = ["Any term", "Fall", "Winter", "Summer"];
const subjectOptions = [
  "All subjects",
  ...Array.from(new Set(typedCourses.map((course) => course.subject))).sort(),
];

function getResultLevel(
  selectedCourses: Course[],
  workloadScore: number,
  averageDifficulty: number,
): ResultLevel {
  const totalCredits = selectedCourses.reduce((sum, course) => sum + course.credits, 0);
  const labCourses = selectedCourses.filter((course) => course.hasLab).length;
  const highDifficultyCourses = selectedCourses.filter((course) => course.difficulty >= 4).length;

  if (
    totalCredits >= 18 ||
    workloadScore >= 72 ||
    averageDifficulty >= 4 ||
    highDifficultyCourses >= 3 ||
    labCourses >= 2
  ) {
    return "risky";
  }

  if (totalCredits >= 16 || workloadScore >= 54 || averageDifficulty >= 3.5) {
    return "heavy";
  }

  if (totalCredits >= 12 && workloadScore >= 30) {
    return "balanced";
  }

  return "light";
}

function getWorkloadScore(coursesToScore: Course[]) {
  return coursesToScore.reduce((sum, course) => {
    const labBump = course.hasLab ? 2 : 0;
    const prereqBump = Math.min(course.prerequisites.length * 0.35, 1.5);
    return sum + course.credits * course.difficulty + labBump + prereqBump;
  }, 0);
}

function scoreLabel(course: Course) {
  if (course.difficultySource === "student") {
    return `${course.difficulty.toFixed(1)}/5 from ${course.reviewCount} reviews`;
  }
  return `${course.difficulty.toFixed(1)}/5 estimated`;
}

function getAverageDifficulty(coursesToAverage: Course[]) {
  if (coursesToAverage.length === 0) return 0;
  return (
    coursesToAverage.reduce((sum, course) => sum + course.difficulty, 0) /
    coursesToAverage.length
  );
}

function buildYearPlan(
  selectedCourses: Course[],
  targetPerTerm: Record<TermName, number>,
) {
  const planned: Record<TermName, Course[]> = {
    Fall: [],
    Winter: [],
    Summer: [],
  };
  const warnings: PlanWarning[] = [];
  const selectedCodes = new Set(selectedCourses.map((course) => course.code));
  const plannedCodes = new Set<string>();
  const sortedCourses = [...selectedCourses].sort((a, b) => {
    const aLevel = Number.parseInt(a.id.replace(/^[A-Z]+/u, "").slice(0, 1), 10) || 9;
    const bLevel = Number.parseInt(b.id.replace(/^[A-Z]+/u, "").slice(0, 1), 10) || 9;
    if (aLevel !== bLevel) return aLevel - bLevel;
    return a.prerequisites.length - b.prerequisites.length;
  });

  for (const course of sortedCourses) {
    const selectedPrereqs = course.prerequisites.filter((prereq) =>
      selectedCodes.has(prereq),
    );
    const missingPrereqs = course.prerequisites.filter(
      (prereq) => !selectedCodes.has(prereq),
    );
    let placed = false;

    const rankedTerms = planningTerms
      .filter((termName) => course.termAvailability.includes(termName))
      .sort((a, b) => {
        const aHasPrereqs = selectedPrereqs.every((prereq) => plannedCodes.has(prereq));
        const bHasPrereqs = selectedPrereqs.every((prereq) => plannedCodes.has(prereq));
        if (aHasPrereqs !== bHasPrereqs) return aHasPrereqs ? -1 : 1;
        const aRoom = Math.max(targetPerTerm[a] - planned[a].length, 0);
        const bRoom = Math.max(targetPerTerm[b] - planned[b].length, 0);
        if (aRoom !== bRoom) return bRoom - aRoom;
        return getWorkloadScore(planned[a]) - getWorkloadScore(planned[b]);
      });

    for (const termName of rankedTerms) {
      const termIndex = planningTerms.indexOf(termName);
      const prereqsMet = selectedPrereqs.every((prereq) => {
        const prereqCourse = selectedCourses.find((candidate) => candidate.code === prereq);
        if (!prereqCourse) return true;
        const prereqTerm = planningTerms.find((candidateTerm) =>
          planned[candidateTerm].some((plannedCourse) => plannedCourse.code === prereq),
        );
        return prereqTerm ? planningTerms.indexOf(prereqTerm) < termIndex : false;
      });

      if (!prereqsMet) continue;
      planned[termName].push(course);
      plannedCodes.add(course.code);
      placed = true;
      break;
    }

    if (!placed) {
      warnings.push({
        course,
        message:
          course.termAvailability.length > 0
            ? "Could not place after selected prerequisites with the available terms."
            : "No Fall/Winter/Summer availability listed.",
      });
    }

    if (missingPrereqs.length > 0) {
      warnings.push({
        course,
        message: `Prerequisites not in this wishlist: ${missingPrereqs.join(", ")}.`,
      });
    }
  }

  const terms = planningTerms.map((termName) => {
    const termCourses = planned[termName];
    const credits = termCourses.reduce((sum, course) => sum + course.credits, 0);
    const averageDifficulty = getAverageDifficulty(termCourses);
    const workload = getWorkloadScore(termCourses);

    return {
      term: termName,
      courses: termCourses,
      credits,
      workload,
      resultLevel: getResultLevel(termCourses, workload, averageDifficulty),
    };
  });

  return { terms, warnings };
}

export default function Home() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("Any term");
  const [subject, setSubject] = useState("All subjects");
  const [onlyStudentRated, setOnlyStudentRated] = useState(false);
  const [targetPerTerm, setTargetPerTerm] = useState<Record<TermName, number>>({
    Fall: 5,
    Winter: 5,
    Summer: 0,
  });

  const selectedCourses = useMemo(
    () =>
      selectedIds
        .map((id) => typedCourses.find((course) => course.id === id))
        .filter((course): course is Course => Boolean(course)),
    [selectedIds],
  );

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return typedCourses
      .filter((course) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          `${course.code} ${course.name} ${course.department} ${course.description}`
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesTerm =
          term === "Any term" || course.termAvailability.includes(term);
        const matchesSubject = subject === "All subjects" || course.subject === subject;
        const matchesDifficultySource =
          !onlyStudentRated || course.difficultySource === "student";
        return matchesQuery && matchesTerm && matchesSubject && matchesDifficultySource;
      })
      .sort((a, b) => {
        const selectedA = selectedIds.includes(a.id) ? 1 : 0;
        const selectedB = selectedIds.includes(b.id) ? 1 : 0;
        if (selectedA !== selectedB) return selectedB - selectedA;
        if (a.difficultySource !== b.difficultySource) {
          return a.difficultySource === "student" ? -1 : 1;
        }
        return b.reviewCount - a.reviewCount;
      })
      .slice(0, 80);
  }, [onlyStudentRated, query, selectedIds, subject, term]);

  const totalCredits = selectedCourses.reduce((sum, course) => sum + course.credits, 0);
  const averageDifficulty = getAverageDifficulty(selectedCourses);
  const workloadScore = getWorkloadScore(selectedCourses);
  const resultLevel = getResultLevel(selectedCourses, workloadScore, averageDifficulty);
  const yearPlan = useMemo(
    () => buildYearPlan(selectedCourses, targetPerTerm),
    [selectedCourses, targetPerTerm],
  );
  const selectedPrereqs = new Set(selectedCourses.map((course) => course.code));
  const missingPrereqCourses = selectedCourses.filter((course) =>
    course.prerequisites.some((prereq) => !selectedPrereqs.has(prereq)),
  );

  const addCourse = (courseId: string) => {
    setSelectedIds((current) => {
      if (current.includes(courseId)) return current;
      return [...current, courseId];
    });
  };

  const removeCourse = (courseId: string) => {
    setSelectedIds((current) => current.filter((id) => id !== courseId));
  };

  return (
    <main className="min-h-screen bg-paper">
      <nav className="sticky top-0 z-20 border-b border-ink/10 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#planner" className="text-sm font-bold text-ink">
            Semester Balance Checker
          </a>
          <div className="flex items-center gap-3 text-sm font-semibold text-ink/65">
            <a href="#planner" className="transition hover:text-teal">
              Planner
            </a>
            <a href="#wishlist" className="transition hover:text-teal">
              Wishlist
            </a>
            <a href="#year-plan" className="transition hover:text-teal">
              Year plan
            </a>
          </div>
        </div>
      </nav>

      <section
        id="planner"
        className="mx-auto flex w-full max-w-7xl scroll-mt-20 flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8"
      >
        <header className="grid gap-4 border-b border-ink/10 pb-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal">
              McGill course planning website
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-normal text-ink sm:text-5xl">
              Plan a balanced McGill year
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-ink/70">
              Search real McGill courses, add every class you are considering, and
              generate a Fall/Winter/Summer plan using credits, labs, prerequisites,
              availability, and student difficulty data.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="#wishlist"
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-bold text-white transition hover:bg-teal"
              >
                View wishlist
              </a>
              <a
                href="#year-plan"
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-ink/15 px-4 text-sm font-bold text-ink transition hover:border-ink/40 hover:bg-white"
              >
                Generate year plan
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <Metric label="Wishlist" value={selectedCourses.length.toString()} />
            <Metric label="Credits" value={totalCredits.toString()} />
            <Metric label="Avg difficulty" value={averageDifficulty.toFixed(1)} />
            <Metric label="Workload" value={Math.round(workloadScore).toString()} />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-ink">Build your wishlist</h2>
                  <p className="mt-1 text-sm text-ink/60">
                    Search {typedCourses.length.toLocaleString()} McGill courses, then add
                    every class you might want to take.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setTerm("Any term");
                    setSubject("All subjects");
                    setOnlyStudentRated(false);
                  }}
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-ink/40 hover:bg-mist"
                >
                  Clear filters
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_150px]">
                <label className="block">
                  <span className="text-sm font-bold text-ink">Search</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Try COMP 250, calculus, psychology..."
                    className="mt-2 h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-ink">Subject</span>
                  <select
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
                  >
                    {subjectOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-ink">Term</span>
                  <select
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
                  >
                    {termOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-md bg-mist px-3 py-2 text-sm font-semibold text-ink/75">
                <input
                  type="checkbox"
                  checked={onlyStudentRated}
                  onChange={(event) => setOnlyStudentRated(event.target.checked)}
                  className="h-4 w-4 accent-teal"
                />
                Student-rated difficulty only
              </label>
            </div>

            <div className="mt-5 grid gap-3">
              {filteredCourses.map((course) => {
                const isSelected = selectedIds.includes(course.id);

                return (
                  <article
                    key={course.id}
                    className="rounded-lg border border-ink/10 bg-mist/55 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-ink">
                            {course.code} · {course.name}
                          </h3>
                          {course.difficultySource === "student" ? (
                            <span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-bold text-teal">
                              Student-rated
                            </span>
                          ) : (
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink/55">
                              Estimated
                            </span>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/65">
                          {course.description || course.department}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          isSelected ? removeCourse(course.id) : addCourse(course.id)
                        }
                        className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-md px-4 text-sm font-bold transition ${
                          isSelected
                            ? "border border-ink/15 bg-white text-ink hover:bg-red-50 hover:text-red-700"
                            : "bg-ink text-white hover:bg-teal"
                        }`}
                      >
                        {isSelected ? "Remove" : "Add"}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-ink/70 sm:grid-cols-2 xl:grid-cols-4">
                      <Detail label="Credits" value={`${course.credits}`} />
                      <Detail label="Difficulty" value={scoreLabel(course)} />
                      <Detail label="Terms" value={course.termAvailability.join(", ") || "TBA"} />
                      <Detail label="Department" value={course.department} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <div className={`rounded-lg border p-4 ${levelStyles[resultLevel]}`}>
                <p className="text-sm font-semibold uppercase tracking-[0.16em]">
                  Wishlist load
                </p>
                <p className="mt-2 text-2xl font-bold">{levelCopy[resultLevel]}</p>
              </div>

              <p className="mt-4 text-sm leading-6 text-ink/65">
                Add as many courses as you want. The year planner below distributes them
                across terms using availability and selected prerequisite order.
              </p>
            </section>

            <section
              id="wishlist"
              className="scroll-mt-20 rounded-lg border border-ink/10 bg-white p-5 shadow-soft"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-ink">Course wishlist</h2>
                  <p className="mt-1 text-sm text-ink/60">
                    {selectedCourses.length} selected for the year planner.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="inline-flex min-h-9 items-center justify-center rounded-md border border-ink/15 px-3 text-sm font-semibold text-ink transition hover:border-ink/40 hover:bg-mist"
                >
                  Reset
                </button>
              </div>

              {missingPrereqCourses.length > 0 ? (
                <div className="mt-4 rounded-md border border-clay/25 bg-clay/10 px-3 py-2 text-sm text-clay">
                  Some selected courses list prerequisites that are not in this plan.
                  Check your transcript before registering.
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {selectedCourses.length > 0 ? (
                  selectedCourses.map((course) => (
                    <SelectedCourse
                      key={course.id}
                      course={course}
                      missingPrereqs={course.prerequisites.filter(
                        (prereq) => !selectedPrereqs.has(prereq),
                      )}
                      onRemove={() => removeCourse(course.id)}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-ink/15 p-4 text-sm leading-6 text-ink/60">
                    Add courses from search to build a year plan.
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>

        <section
          id="year-plan"
          className="scroll-mt-20 rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5"
        >
          <div className="grid gap-4 border-b border-ink/10 pb-5 lg:grid-cols-[1fr_0.95fr] lg:items-end">
            <div>
              <h2 className="text-xl font-bold text-ink">Year planner</h2>
              <p className="mt-1 text-sm leading-6 text-ink/60">
                Pick your target course count for each term. Courses are placed only in
                terms where they are offered, and selected prerequisites are scheduled
                before dependent courses when possible.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {planningTerms.map((termName) => (
                <label key={termName} className="block">
                  <span className="text-sm font-bold text-ink">{termName}</span>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={targetPerTerm[termName]}
                    onChange={(event) =>
                      setTargetPerTerm((current) => ({
                        ...current,
                        [termName]: Number(event.target.value),
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {yearPlan.terms.map((termPlan) => (
              <TermColumn key={termPlan.term} termPlan={termPlan} />
            ))}
          </div>

          {yearPlan.warnings.length > 0 ? (
            <div className="mt-5 rounded-lg border border-clay/25 bg-clay/10 p-4">
              <h3 className="font-bold text-clay">Planning notes</h3>
              <div className="mt-3 grid gap-2">
                {yearPlan.warnings.slice(0, 8).map((warning) => (
                  <p key={`${warning.course.id}-${warning.message}`} className="text-sm text-clay">
                    <span className="font-bold">{warning.course.code}:</span>{" "}
                    {warning.message}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 rounded-lg border border-ink/10 bg-mist p-5 sm:grid-cols-3">
          <div>
            <h2 className="text-lg font-bold text-ink">1. Search</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Find courses by code, subject, department, or topic.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink">2. Wishlist</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Add every course you are considering, not just five.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink">3. Plan</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              The site places courses into terms and flags prerequisite issues.
            </p>
          </div>
        </section>

        <footer className="border-t border-ink/10 py-6 text-sm text-ink/55">
          Built as an independent student planning website using local McGill course
          data and public student review averages.
        </footer>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-3 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
        {label}
      </p>
      <p className="mt-1 break-words font-semibold text-ink/75">{value}</p>
    </div>
  );
}

function TermColumn({ termPlan }: { termPlan: TermPlan }) {
  const averageDifficulty = getAverageDifficulty(termPlan.courses);

  return (
    <article className="rounded-lg border border-ink/10 bg-mist/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-ink">{termPlan.term}</h3>
          <p className="mt-1 text-sm text-ink/60">
            {termPlan.courses.length} courses · {termPlan.credits} credits
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${levelStyles[termPlan.resultLevel]}`}
        >
          {levelCopy[termPlan.resultLevel].replace(" semester", "")}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Detail label="Difficulty" value={averageDifficulty.toFixed(1)} />
        <Detail label="Workload" value={Math.round(termPlan.workload).toString()} />
      </div>

      <div className="mt-4 space-y-3">
        {termPlan.courses.length > 0 ? (
          termPlan.courses.map((course) => (
            <div key={course.id} className="rounded-md bg-white p-3">
              <p className="font-bold text-ink">{course.code}</p>
              <p className="mt-1 text-sm text-ink/65">{course.name}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-ink/60">
                <span>{course.credits} cr</span>
                <span>Diff {course.difficulty.toFixed(1)}</span>
                {course.hasLab ? <span className="text-clay">Lab</span> : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-ink/15 bg-white p-3 text-sm text-ink/55">
            No courses placed here yet.
          </div>
        )}
      </div>
    </article>
  );
}

function SelectedCourse({
  course,
  missingPrereqs,
  onRemove,
}: {
  course: Course;
  missingPrereqs: string[];
  onRemove: () => void;
}) {
  return (
    <article className="rounded-lg border border-ink/10 bg-mist/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-ink">{course.code}</p>
          <p className="mt-1 text-sm text-ink/65">{course.name}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md bg-white px-3 text-sm font-bold text-ink transition hover:bg-red-50 hover:text-red-700"
        >
          Remove
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-white px-2.5 py-1 text-ink/70">
          {course.credits} credits
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-ink/70">
          Difficulty {course.difficulty.toFixed(1)}
        </span>
        {course.rating ? (
          <span className="rounded-full bg-white px-2.5 py-1 text-ink/70">
            Rating {course.rating.toFixed(1)}
          </span>
        ) : null}
        {course.averageGrade ? (
          <span className="rounded-full bg-white px-2.5 py-1 text-ink/70">
            Avg {course.averageGrade}
          </span>
        ) : null}
        {course.hasLab ? (
          <span className="rounded-full bg-white px-2.5 py-1 text-clay">
            Lab component
          </span>
        ) : null}
      </div>

      {missingPrereqs.length > 0 ? (
        <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm font-medium text-clay">
          Missing prereqs in this plan: {missingPrereqs.join(", ")}
        </p>
      ) : null}

      {course.prerequisitesText ? (
        <p className="mt-3 text-sm leading-6 text-ink/60">{course.prerequisitesText}</p>
      ) : null}
    </article>
  );
}
