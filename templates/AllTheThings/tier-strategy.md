<%*
const words = ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Mixed"];
const tiers = ["1", "2", "3", "4", "mixed"];
const tier = await tp.system.suggester(words, tiers);
console.log(tier);

let embed = "";
let calloutType = "tip";
let prefix = `Tier ${tier}`
switch(tier) {
  case "1":
    embed = "demesne/self/adhd/strategies/tier-1-visibility.md";
    calloutType = "warning";
    break;
  case "2":
    embed = "demesne/self/adhd/strategies/tier-2-work-activation.md";
    break;
  case "3":
    embed = "demesne/self/adhd/strategies/tier-3-stable.md";
    break;
  case "4":
    embed = "demesne/self/adhd/strategies/tier-4-braking.md";
    calloutType = "warning";
    break;
  case "2/4":
  case "mixed":
    embed = "demesne/self/adhd/strategies/tier-mixed.md";
    calloutType = "warning";
    prefix = `Mixed Tier`
    break;
}

if (embed) { %>
> [!<% calloutType %>]- <% prefix %> Strategies
> ![invisible-embed](<% embed %>)
^tier-strategy
<%* } -%>
