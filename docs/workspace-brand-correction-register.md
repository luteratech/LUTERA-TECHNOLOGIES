# Workspace design corrections and selection controls

2 November 2026. The supplied DESIGN.md, design-system archive and brand book
are the visual references. Earlier owner choices still govern the business
scope, deferred tax records and desktop/tablet sidebar behaviour.

| Area | Correction | Status |
| --- | --- | --- |
| Palette and logo | Exact #2E5BFF blue, #161A3D Navy, Paper and approved logo files | Applied |
| Core type and surfaces | Sora 400/500/600, white cards and flat blue-wash sections | Applied |
| Single-value dropdowns | Shared brand border, arrow, focus and option treatment | Implemented; modern native picker where supported, platform picker fallback elsewhere |
| Multi-selection | Search, checkbox choices, removable tags, count, keyboard/Escape and mobile bottom panel | Implemented for workspace roles, departments and approval authorities |
| Roles | Persist multiple roles and enforce their combined access with current membership and MFA checks | Implemented; Owner selected alone, since it includes all authority |
| Business access | Assign multiple departments and independently choose approval areas in one atomic save | Implemented; unselected departments unchanged |
| Sensitive authority | Multiple journal-posting, period-closing and document-signing permissions | Implemented; each still needs underlying record access |
| Form type and spacing | Align remaining labels/helper text, older gaps, borders and focus styles with the token scale | Remaining |
| Status tags | Consistent pill shape, sentence case and approved semantic colours | Remaining |
| Numeric typography | Load and apply JetBrains Mono to document references, serials, figures and totals | Remaining |
| Invoice details | Align bank/tax placement and footer with the brand book while preserving record snapshots | Remaining |
| Business cards | Navy branded front, Paper details back, correct logo lockup, safe margins and print bleed | Dimensions corrected; layout/print finish remaining |
| ID cards | Navy front, tone-on-tone cropped symbol, Paper photo panel, white name and mono staff number | Remaining |
| Component consistency | Review remaining older radii, shadows, table states and error messages across all modules | Remaining |

## Selection design and research

Single selections retain real HTML selects, browser keyboard/type-ahead and form
behaviour. Supported browsers receive the customizable native picker; other
browsers retain a styled control and their accessible platform popup. They do
not all expose identical open-menu styling. No third-party script is added.

Multiple selections use a labelled nonmodal checkbox picker with search rather
than a single-choice listbox. Selected items remain visible as tags. The panel
closes with Done, Escape, an outside click or focus leaving it. On small screens
it uses a bottom panel; it remains usable at 320 px.

Research references:
- [MDN: customizable select elements](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select)
- [W3C: listbox selection and keyboard guidance](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
- [Radix: Select interactions and type-ahead](https://www.radix-ui.com/primitives/docs/components/select)

## Access behaviour

Workspace roles are Owner, Operations administrator, Website administrator,
Accountant/finance, Staff cards designer and Staff. Several may be combined.
Sales, Procurement, Inventory, Projects, Support, Finance and Reports are
separate department grants; staff can have several. Role assignment does not
silently create approval authority. Owner changes remain protected, including
the last active owner and the ban on changing one's own membership.

Business permissions updates every selected department in one transaction,
with explicit approval selections, edit permission and record scope. This is an
apply-to-selected operation: selecting an area with approval unticked removes
approval there; unselected areas are unchanged. Sensitive posting, closing and
signing are another separate multi-selection. Company approval rules, fresh
signature MFA and source-version checks remain in force.

Open Design coordination is pending its independently registered local runtime
connection. The Open Design skill was read, but no Open Design generation,
design review or artifact delivery is claimed. This register and the code work
continue under the user's direct implementation request.
