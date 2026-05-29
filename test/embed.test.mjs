import assert from "node:assert";

function stubDom() {
  const el = {
    _html: "", set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
    style: {}, appendChild() {}, setAttribute() {},
  };
  global.document = {
    getElementById: () => el,
    createElement: () => ({ style: {}, setAttribute() {} }),
    addEventListener() {},
  };
  return el;
}

// empty URL -> placeholder
let el = stubDom();
const mod = await import(`../js/powerbi-embed.js?empty=${Date.now()}`);
mod.renderEmbed("");
assert.ok(/pending|publishing|發布/i.test(el.innerHTML), "shows pending placeholder");

// real URL -> iframe with that src
el = stubDom();
mod.renderEmbed("https://app.powerbi.com/view?r=ABC123");
assert.ok(el.innerHTML.includes("<iframe"), "renders iframe");
assert.ok(el.innerHTML.includes("app.powerbi.com/view?r=ABC123"), "iframe has src");
console.log("embed.test OK");
