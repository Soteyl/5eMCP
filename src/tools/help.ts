import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const HELP_CONTENT = {
  overview:
    "5eMCP provides D&D 5e content lookup and DM utility tools backed by live 5etools data. " +
    "Call this tool first when unsure which tool to use.",

  quick_start: {
    "Don't know what type of content it is": "→ omnisearch — searches all types at once",
    "Know the type, want a browsable list or to filter": "→ <type>_search (spell_search, monster_search, item_search, etc.)",
    "Have an exact name, want the complete entry": "→ <type>_get (spell_get, monster_get, item_get, etc.)",
    "Want a class with full feature text": "→ class_get — returns resolvedFeatures with complete feature descriptions; ruleset selects edition",
    "Want class features at a specific level": "→ classfeature_search with class_name and level filters",
    "Want subclass list or specific subclass": "→ subclass_search / subclass_get",
    "Want subclass feature details": "→ subclassfeature_search with subclass_name and optional level filters",
    "Want prose text from a sourcebook or adventure": "→ book_content_get with source abbreviation (PHB, DMG, XGE, CoS…)",
    "Building a homebrew monster, need CR": "→ cr_calculate (from HP/AC/DPR), then cr_scale to verify stat ranges",
    "Checking if an encounter is appropriately challenging": "→ encounter_build with party levels and monster CRs",
    "Generating loot for a defeated monster": "→ loot_generate",
    "Accessing an unusual content type without a typed tool": "→ fetch_content (universal fallback — prefer typed tools first)",
    "See what sources and content types are available": "→ list_sources or manifest_status",
  },

  tool_groups: {
    discovery: {
      tools: ["omnisearch"],
      description: "Cross-type search. Use as your starting point when the content type is unknown.",
      notes: [
        "Returns up to 5 results per content type by default (adjust with per_type_limit)",
        "Includes homebrew by default — set include_homebrew=false for official-only results",
        "Each result has an entityType field identifying its content type",
        "For deeper searches within a specific type, follow up with the typed _search tool",
      ],
    },

    typed_search: {
      tools: [
        "spell_search", "spell_get",
        "monster_search", "monster_get",
        "item_search", "item_get",
        "feat_search", "feat_get",
        "race_search", "race_get",
        "background_search", "background_get",
        "class_search", "class_get",
        "subclass_search", "subclass_get",
        "classfeature_search",
        "subclassfeature_search",
        "condition_search", "vehicle_search", "object_search", "trap_search",
        "psionic_search", "deck_search", "reward_search", "optfeature_search",
        "table_search", "variantrule_search", "deity_search", "language_search",
        "skill_search", "sense_search", "book_search", "book_get",
        "adventure_search", "adventure_get",
      ],
      when_to_use_search: "When you know the content type and want a filtered list. Supports structured filters (level, school, cr_max, type, rarity, environment).",
      when_to_use_get: "When you have the exact name and want the complete entry with description merged in. Faster and more complete than searching.",
      class_notes: {
        class_get: "Returns resolvedFeatures array with full feature text at each level. Ruleset param selects edition: '2024' returns XPHB features, '2014' returns PHB features.",
        subclass_search: "Supports class_name filter (e.g. class_name='Wizard') to list subclasses for a specific class.",
        classfeature_search: "Filters: class_name (e.g. 'Wizard'), level (1–20). Returns classFeature entries with full text.",
        subclassfeature_search: "Filters: class_name, subclass_name (e.g. 'Abjurer'), level. Returns subclassFeature entries with full text.",
        edition_note: "Class files contain both 2014 and 2024 editions. The ruleset param on all class tools selects the correct edition automatically.",
      },
    },

    book_content: {
      tools: ["book_content_get"],
      description: "Retrieves prose text from sourcebooks and adventures using a drill-down navigation model.",
      usage: [
        "1. Call with source only → returns table of contents (chapter/section names)",
        "2. Call with source + section → returns subsection list, or full text if no subsections",
        "3. Call with source + section + subsection → returns rendered text of that subsection",
      ],
      source_examples: "PHB, DMG, XGE, TCE, XPHB, SCC, EGW, CoS, LMoP, SCC-CK",
      note: "For sourcebook metadata (title, published date), use book_get instead.",
    },

    dm_calculators: {
      tools: ["cr_calculate", "cr_scale", "encounter_build", "loot_generate"],
      descriptions: {
        cr_calculate: "Calculates CR for a homebrew monster from its defensive stats (HP, AC) and offensive stats (DPR, attack bonus or save DC). Supports damage immunity/resistance/vulnerability adjustments.",
        cr_scale: "Looks up expected stat ranges for any CR (0 through 30): proficiency bonus, AC, HP range, attack bonus, DPR range, save DC. Useful for checking whether a monster's stats fit its intended CR.",
        encounter_build: "Evaluates encounter difficulty for a party given monster CRs. Supports both 2014 (four tiers + XP multiplier) and 2024 (three tiers, no multiplier) rules.",
        loot_generate: "Returns the DMG individual treasure table for a monster's CR bracket (0–4, 5–10, 11–16, 17+) with d100 ranges and average coin amounts.",
      },
    },

    meta_and_fallback: {
      tools: ["manifest_status", "list_sources", "fetch_content"],
      descriptions: {
        manifest_status: "Returns manifest build time, file counts by content type, and which types use passthrough vs typed handlers.",
        list_sources: "Lists all available source abbreviations with their content types and file counts. Filter by content_type or set homebrew=true for homebrew sources.",
        fetch_content: "Universal fallback — fetches any file in the manifest by content_type and file_name. Returns tag-resolved JSON. Prefer typed _search/_get tools when available. Omit file_name to list files for a content type.",
      },
    },
  },

  rulesets: {
    "2024": "Uses 5etools-src (Player's Handbook 2024 / XPHB). Default ruleset.",
    "2014": "Uses 5etools-2014-src (original Player's Handbook / PHB).",
    class_edition_note:
      "For classes that exist in both editions (Wizard, Fighter, etc.), class_get and subclass_get automatically return the edition matching the ruleset param.",
  },

  homebrew: {
    default_behavior: "Most typed search tools default to include_homebrew=false (official content only). omnisearch defaults to include_homebrew=true.",
    homebrew_source: "TheGiddyLimit/homebrew repository on GitHub",
    how_to_include: "Pass include_homebrew=true to any _search tool to include homebrew alongside official results.",
  },
};

export function registerHelpTool(server: McpServer): void {
  server.tool(
    "help",
    "Returns a guide to all available 5eMCP tools and when to use each. " +
      "Call this first when unsure which tool to reach for — it explains the decision between " +
      "omnisearch vs typed search vs _get tools, class feature lookups, book content, " +
      "DM calculators, and the fetch_content fallback.",
    {},
    async () => ({
      content: [{ type: "text", text: JSON.stringify(HELP_CONTENT, null, 2) }],
    }),
  );
}
