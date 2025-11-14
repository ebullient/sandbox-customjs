<%*
const words = ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Mixed"];
const tiers = ["1", "2", "3", "4", "mixed"];
const tier = await tp.system.suggester(words, tiers);

let block = "";
let deck = ""
switch(tier) {
  case "1":
    block = "tier1-stay-visible";
    deck = "tier-strategies/stay-visible ";
    break;
  case "2":
    block = "tier2-maintain";
    deck = "tier-strategies/work-activation";
    break;
  case "3":
    block = "tier3-stable-growth";
    break;
  case "4":
    block = "tier4-slow-down";
    deck = "tier-strategies/braking";
    break;
  case "2/4":
  case "mixed":
    block = "tier-mixed";
    deck = "tier-strategies/mixed";
    break;
}

let embed = "";
if (block) {
    const base = "demesne/self/adhd/tier-system/tier-guides-concise.md";
    const file = await tp.file.find_tfile(base);
    const fileCache = this.app.metadataCache.getFileCache(file);
    if (fileCache.blocks[block]) {
        const blockPosition = fileCache.blocks[block].position;
        const content = await app.vault.cachedRead(file);
        embed= content.slice(
                blockPosition.start.offset, 
                blockPosition.end.offset);
    }
}
if (embed) { -%>
<% embed %>
<%* if (deck) { 
const strategy = window.simpleFlashcards?.api?.embedCard(deck);
%>
<% strategy %>
<%* } 
} -%>
