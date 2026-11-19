// Builds exports/Domain-Roadmap-Slide.pptx (one 16:9 slide, editable text and shapes).
// Run: node extras/roadmap/build.js   (from domain-intel/)
// Counts are read from data/dist/coverage.json so the slide stays in step with the build.
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "exports", "Domain-Roadmap-Slide.pptx");
const APPLY_THEME = process.env.PPTX_APPLY_THEME; // optional path to the pptx skill's apply_theme.js

const t = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "dist", "coverage.json"), "utf8")).totals;
const n = (x) => x.toLocaleString("en-US");
// The feed grows during the day, so the story count is rounded down to the nearest 50 ("Over 500").
const stories = Math.floor(t.feed_articles / 50) * 50;
const verified = Math.round(t.all_facts_confidence.verified_pct);

const TITLE = "From today's map and feed to a context layer the whole firm can ask";

const STAGES = [
	{
		label: "TODAY",
		head: "Built in a day, public sources only",
		bullets: [
			`${n(t.builders_total)} builders, ${n(t.people_mapped)} people, ${n(t.regional_heads_found)} regional heads`,
			`Over ${n(stories)} stories scored, with cutoff and votes`,
			"Workbook, JSON and live portal",
			`Every fact has source, date, confidence; ${verified}% Verified`,
		],
		takes: "Done. Public sources and a model, nothing internal.",
	},
	{
		label: "NEXT 2 TO 4 WEEKS",
		head: "Add what Domain knows",
		bullets: [
			"Asset managers add wallet share, who we know, why we are number two",
			"Votes tune the scoring",
			"“Send me anything 70 or higher”, plus a daily digest",
			"Nightly refresh; alerts when a mapped executive changes seats",
		],
		takes: "A few hours from asset managers, an email or Teams sender, a nightly job.",
	},
	{
		label: "ONE TO THREE MONTHS",
		head: "Connect to Darwin and Tim's scoring",
		bullets: [
			"One scoring and voting service for news, email, meeting notes",
			"Darwin counterparties, exposures and deals joined: mandate rank test, concentration, wallet share",
			"Pre-call briefs with internal history",
			"An MCP server so company agents can use the map and feed directly",
		],
		takes: "Read access to Darwin, Tim's nightly scan, one shared ID list, an MCP server.",
	},
	{
		label: "DESTINATION",
		head: "The context layer anyone can chat with",
		bullets: [
			"Organised by entity, so the model gets the right page",
			"Each builder, person, deal: a short card, sourced facts, pointers",
			"Agents get purpose-built tools: find a builder, who covers a state, who to call, what changed, top stories",
			"Permissions by role",
		],
		takes: "Cards kept current, access by role, a chat window for staff.",
	},
];

const PRINCIPLES = [
	"Scripts collect. The model judges. People correct.",
	"Every fact carries a source, a date and a confidence tag.",
	"Context is organised by entity, so the model reads a page, not the archive.",
];

// One accent (the portal's cobalt) in four strengths, plus ink and two greys.
const THEME = {
	name: "Domain Roadmap",
	headFontFace: "Calibri",
	bodyFontFace: "Calibri",
	colors: {
		dk1: "14213D", lt1: "FFFFFF", dk2: "55607A", lt2: "F1F3F8",
		accent1: "1F4FD1", accent2: "4A6EDB", accent3: "A9BDF0", accent4: "DCE5FA",
		accent5: "1F4FD1", accent6: "1F4FD1", hlink: "1F4FD1", folHlink: "55607A",
	},
};

async function main() {
	const pres = new pptxgen();
	pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
	pres.title = "Domain roadmap";
	pres.author = "RWorks";
	pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
	const C = pres.SchemeColor;

	const M = 0.5, W = 13.333, GAP = 0.2;
	const colW = (W - 2 * M - 3 * GAP) / 4;

	pres.defineSlideMaster({
		title: "Roadmap",
		background: { color: "FFFFFF" },
		objects: [
			{ placeholder: { options: { name: "title", type: "title", x: M, y: 0.3, w: W - 2 * M, h: 0.65, fontSize: 28, bold: true, color: C.text1, align: "left", valign: "middle", margin: 0 }, text: "" } },
		],
	});

	const s = pres.addSlide({ masterName: "Roadmap" });
	s.addText(TITLE, { placeholder: "title" });

	const fills = [C.accent4, C.accent3, C.accent2, C.accent1];
	const labelColors = [C.text1, C.text1, C.background1, C.background1];
	const Y_BAND = 1.1, H_BAND = 0.58;
	const Y_HEAD = 1.86, H_HEAD = 0.6;
	const Y_BUL = 2.56, H_BUL = 2.4;
	const Y_TAKES = 5.15, H_TAKES = 0.92;
	const Y_PRIN = 6.3, H_PRIN = 0.7;

	STAGES.forEach((st, i) => {
		const x = M + i * (colW + GAP);
		// Stepped band: arrow-shaped stage markers, each a stronger tint than the last.
		s.addShape(i === 3 ? pres.ShapeType.rect : pres.ShapeType.homePlate, {
			x, y: Y_BAND, w: i === 3 ? colW : colW + GAP - 0.04, h: H_BAND,
			fill: { color: fills[i] }, line: { type: "none" }, objectName: `Stage ${i + 1} marker`,
		});
		s.addText(st.label, {
			x: x + 0.15, y: Y_BAND, w: colW - 0.4, h: H_BAND, isTextBox: true, margin: 0,
			fontSize: 15, bold: true, color: labelColors[i], valign: "middle", objectName: `Stage ${i + 1} label`,
		});
		s.addText(st.head, {
			x, y: Y_HEAD, w: colW, h: H_HEAD, isTextBox: true, margin: 0,
			fontSize: 16, bold: true, color: C.text1, valign: "top", objectName: `Stage ${i + 1} heading`,
		});
		s.addText(
			st.bullets.map((b, j) => ({ text: b, options: { bullet: { indent: 14 }, breakLine: j < st.bullets.length - 1 } })),
			{ x, y: Y_BUL, w: colW, h: H_BUL, isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: "top", paraSpaceAfter: 6, objectName: `Stage ${i + 1} bullets` }
		);
		s.addShape(pres.ShapeType.rect, {
			x, y: Y_TAKES, w: colW, h: H_TAKES, fill: { color: C.background2 }, line: { type: "none" }, objectName: `Stage ${i + 1} takes box`,
		});
		s.addText(
			[
				{ text: "What it takes: ", options: { bold: true, color: C.accent1 } },
				{ text: st.takes, options: { color: C.text1 } },
			],
			{ x: x + 0.12, y: Y_TAKES, w: colW - 0.24, h: H_TAKES, isTextBox: true, margin: 0, fontSize: 14, valign: "middle", objectName: `Stage ${i + 1} what it takes` }
		);
	});

	// Principles band along the bottom.
	s.addShape(pres.ShapeType.rect, {
		x: M, y: Y_PRIN, w: W - 2 * M, h: H_PRIN, fill: { color: C.text1 }, line: { type: "none" }, objectName: "Principles band",
	});
	// Widths follow the length of each line so the first stays on one line.
	const pWs = [4.3, 3.3, 3.63], pGap = 0.3;
	let px = M + 0.25;
	PRINCIPLES.forEach((p, i) => {
		const x0 = px;
		px += pWs[i] + pGap;
		s.addText(p, {
			x: x0, y: Y_PRIN, w: pWs[i], h: H_PRIN, isTextBox: true, margin: 0,
			fontSize: 14, color: C.background1, valign: "middle", objectName: `Principle ${i + 1}`,
		});
	});

	await pres.writeFile({ fileName: OUT });
	if (APPLY_THEME) {
		const { applyTheme } = require(APPLY_THEME);
		await applyTheme(OUT, THEME);
	}

	// Keep the slide's text beside the script.
	const md = [
		`# ${TITLE}`, "",
		"One slide. Source: `extras/roadmap/build.js`; counts from `data/dist/coverage.json`.", "",
		...STAGES.flatMap((st, i) => [
			`## ${i + 1}. ${st.label}: ${st.head}`, "",
			...st.bullets.map((b) => `- ${b}`), "",
			`**What it takes:** ${st.takes}`, "",
		]),
		"## Working principles (bottom band)", "",
		...PRINCIPLES.map((p) => `- ${p}`), "",
	].join("\n");
	fs.writeFileSync(path.join(__dirname, "roadmap.md"), md);
	console.log("wrote", OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
