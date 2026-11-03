---
name: slice-workflow
description: Slice-by-slice delivery loop that keeps state in files — big picture, smallest next slice, plan, implement, run and observe, record findings. Use only when the user explicitly asks for the full workflow or invokes this skill; deliver small or trivial tasks directly instead.
disable-model-invocation: true
---

# Slice workflow

Deliver in slices. Keep state in files, not in conversation memory. Treat any request appended
below as the idea to deliver.

## Steps
1. **Big picture.** Take the idea and write `docs/BIG_PICTURE.md`: goal, expected behavior, and an ordered list of slices. Ask the user only if an ambiguity would change the slice list.
2. **Pick a slice.** Read `docs/BIG_PICTURE.md` and `docs/FINDINGS.md`. Take the smallest next slice that yields observable behavior and think through how to implement it. If the code is unfamiliar, run `/explore` first.
3. **Plan the slice.** In plan mode (`/plan`), write `docs/slices/NN-name/PLAN.md`: expected behavior, steps, files touched, and how it will be run and verified.
4. **Implement** exactly the plan. Leave plan mode first. If the plan is wrong, fix the plan before the code.
5. **Run and verify.** Run what you built and observe the real behavior against the expected behavior. Use Playwright for web UI; run CLIs, servers, and tests directly. Report what you observed, not what you expect.
6. **Note findings.** Append to `docs/FINDINGS.md`: surprises, decisions and why, constraints, follow-ups for later slices. Update `docs/BIG_PICTURE.md` if the picture changed.
7. **Repeat** from step 2 until every slice is done.

## Definition of done
A slice is done when its expected behavior is met, as observed in step 5.
