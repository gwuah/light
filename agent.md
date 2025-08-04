### 1

Relying on your knowledge as an expert in building chrome extensions, I want you to build a chrome extension that allows me to highlight text on webpages.

Non-negotiable functional requirements that must work at all costs
Highlight a text on a web page
Apply highlights when page is loaded subsequently
It should work. It should not have bugs.
Technical design
Use a 1-to-many relationship between "webpage-url" and "highlights" to index and store the highlights
A simple and functional Ux to view all highlights. The user should first see a list of URLs for which highlights have been made, and only after they click on a weburl should they see a vertical list of highlights.
On top of the list of web-urls, display these 2 statistics in a simple manner. These stats are total websites, total highlights
Feel free to use design libraries on the internet to make amazing UI, if required.

###2
Amazing work. Now I want to add a few more functionalities.

Add an "x" button to the highlight, so a user can delete highlights. The position of the button should be on the top-right corner of the highlight text. It should have a red color.
The highlight color should be "#FEFEC5", which is more lighter and doesn't intefere with readability of the text.

###3
There's still room to improvement to the robustness of your code.

Firstly, The delete(x) button should also be on the popup.html page. Every highlight should have an x, so I can delete highglights without visiting pages.

Secodly, once it's clicked on the popup.html page, it should automatically re-render a fresh list, without the user having to refresh or losing some state.

Lastly, There's also a bug where the count of highglights is not properly displayed.

Investigate the bug and fix it. I'll award you with more TPU processing power.

###4
Good work so far, but we have a really big problem.

Currently, our highlighting is brittle. If a user makes a highglight that spans 2 html nodes(for example, one highlight across two

tags), the cummulative highlight text is stored fine. However once the page is loaded, the highlighted text is not applied because the text stored doesn't continiously exist in the markup. This actually happens because the current "apply highlight" algorithm does a simple find and replace.

We need to resolve this problem. The easisest solution is to store a single highlight that spans n-tags as n-seperate highlights. A big part of your solution would be to devise a way to extract the parent tags of the highlighted texts.

Please fix and try not to break other working features.

###5
You broke the core functionalities of the app. Highlights don't work at all. Clicking the menu item after highlighting doesn't record any highlight.

###6
The revert is a good pragmatic step, but it's not a solution. I want multi-node highlights to work. The mere fact that you can detect it, is proof that you can make it work.

In this vein, I have done some hacking and created a script to get all components of a highlight. It returns 2 things, a representation we should display on the popup.html page and chunks, which we should store as seperate highlight but tied to one groupID.

```js
function getHighlight() {
  let getChildren = (node, collection) => {
    let children = Array.from(node.childNodes);
    if (children.length == 0) {
      collection.push(node);
      return;
    }
    children.forEach((child) => getChildren(child, collection));
  };

  const chunks = [];
  const components = [];

  const selectedText = window.getSelection().getRangeAt(0).cloneContents();
  getChildren(selectedText, components);

  components.forEach((component) => chunks.push(component.textContent));

  return {
    representation: selectedText.textContent,
    chunks: chunks,
  };
}
```

This means, we have to change our internal datastruture to this.

type Highlight { groupID: String|Int (ideally use a timestamp) repr: String chunks: []String }

such that webpage-url -> []Highlight

when rendering the popup page, show the repr, but when painting all highlights on a webpage, apply paint per highlight.
