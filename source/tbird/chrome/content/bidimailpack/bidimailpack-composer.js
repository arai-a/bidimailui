function GetCurrentParagraphDirection()
{
  var hasLTR = false, hasRTL = false;
  var editor = GetCurrentEditor();
  if (editor.selection.rangeCount > 0)
  {
    for (i=0; i<editor.selection.rangeCount; ++i)
    {
      var range = editor.selection.getRangeAt(i);
      var node = range.startContainer;
      // walk the tree till we find the endContainer of the selection range,
      // giving our directionality style to everything on our way
      do
      {
        var closestBlockElement = findClosestBlockElement(node);
        if (closestBlockElement)
        {
          var computedDir = closestBlockElement.ownerDocument.defaultView.getComputedStyle(closestBlockElement, "").getPropertyValue("direction");
          switch (computedDir)
          {
            case 'ltr':
              hasLTR = true;
              break;
            case 'rtl':
              hasRTL = true;
              break;
          }
        }
        // This check should be placed here, not as the 'while'
        // condition, to handle cases where begin == end
        if (node == range.endContainer)
          break;
        if (node.firstChild)
          node = node.firstChild;
        else if (node.nextSibling)
          node = node.nextSibling;
        else
          // find a parent node which has anything after
          while (node = node.parentNode)
          {
            if (node.nextSibling)
            {
              node = node.nextSibling;
              break;
            }
          }
      }
      while (node)
    }
  }

  if ((hasLTR && hasRTL) || (!hasLTR && !hasRTL))
    return 'complex';

  if (hasRTL)
    return 'rtl';
  if (hasLTR)
    return 'ltr';

  return null;
}

function SetDocumentDirection(dir) {
  var body = document.getElementById('content-frame').contentDocument.body;
  body.setAttribute('dir', dir);
}

function SwitchDocumentDirection() {
  var currentDir;

  var body = document.getElementById('content-frame').contentDocument.body;
  currentDir = body.getAttribute("dir");

  if ((currentDir == 'rtl') || (currentDir == 'RTL'))
    directionSwitchController.doCommand("cmd_ltr_document");
  else
    directionSwitchController.doCommand("cmd_rtl_document");
}

function composeWindowEditorOnLoadHandler() {

  var editorType = GetCurrentEditorType();

  // show direction buttons?
  if (editorType == 'htmlmail')
  {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
    var hiddenbuttons = false;
    try {
      if (!prefs.getBoolPref('mail.compose.show_direction_buttons'))
        hiddenbuttons = true;
    }
    catch(e) { } // preference is not set.

    // Note: the hidden attribute defaults to being set false
    // Note: the main toolbar buttons are never hidden, since that toolbar
    //       is customizable in tbird anyway
    document.getElementById('ltr-paragraph-direction-broadcaster').setAttribute('hidden',hiddenbuttons);
    document.getElementById('rtl-paragraph-direction-broadcaster').setAttribute('hidden',hiddenbuttons);
  }

  // Direction Controller
  top.controllers.insertControllerAt(1, directionSwitchController);

  // Decide what to show in the contextual menu
  document.getElementById('contextSwitchParagraphDirectionItem').setAttribute('hidden', editorType != 'htmlmail');
  document.getElementById('contextBodyDirectionItem').setAttribute('hidden', editorType == 'htmlmail');

  // the following is a very ugly hack!
  // the reason for it is that without a timeout, it seems
  // that gMsgCompose does often not yet exist when
  // the OnLoad handler runs...
  setTimeout('composeWindowEditorOnLoadHandler2();', 50);
}

function composeWindowEditorOnLoadHandler2() {
  var messageIsAReply = (gMsgCompose.originalMsgURI.length > 0);
  var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
  var body = document.getElementById('content-frame').contentDocument.body;

  try
  {
    // New message OR "Always reply in default direction" is checked
    if (!messageIsAReply || prefs.getBoolPref("mailnews.reply_in_default_direction") )
    {
      try
      {
        var defaultDirection = prefs.getCharPref("mailnews.send_default_direction");
        // aligning to default direction
        if ((defaultDirection == 'rtl') || (defaultDirection == 'RTL'))
          SetDocumentDirection('rtl');
        else
          SetDocumentDirection('ltr');

        directionSwitchController.setAllCasters();
          // the initial setting; perhaps instead of this
          // we should have an 'init' method for the controller?

        //var editor = GetCurrentEditor();
        //editor.document.addEventListener('focus', OnEditorDocumentFocus, true);
        //editor.document.addEventListener('lostfocus', OnEditorDocumentLostFocus, true);

        return;

      } catch(e1) {
        // preference is not set.
      }
    }
  } catch(e2) {
    // reply_in_default_direction preference is not set.
    // we choose "reply_in_default_direction==true" as the default
    // note that since the logic is short-circuit, if this is not a reply we
    // can't get here
  }

  // aligning in same direction as message
  if (hasRTLWord(body))
    SetDocumentDirection('rtl');
  else
    SetDocumentDirection('ltr');

  directionSwitchController.setAllCasters();

  //var editor = GetCurrentEditor();
  //editor.document.addEventListener('focus', OnEditorDocumentFocus, true);
  //editor.document.addEventListener('lostfocus', OnEditorDocumentLostFocus, true);
}

function OnEditorDocumentFocus() {
  directionSwitchController.setAllCasters();
}

function OnEditorDocumentLostFocus() {
  directionSwitchController.setAllCasters();
}

function InstallComposeWindowEditorHandler() {

  // problem: if I add a handler for both events, than the first time
  // a composer window is opened, the handler runs twice; but if I only
  // add a handler for compose-window-reopen, the first time a composer
  // window is opened the handler does not run even once

  document.addEventListener('load', composeWindowEditorOnLoadHandler, true);
  document.addEventListener('compose-window-reopen', composeWindowEditorOnLoadHandler2, true);
  document.addEventListener('keypress', onKeyPress, true);
}

function findClosestBlockElement(node)
{
  // Try to locate the closest ancestor with display:block
  var v = node.ownerDocument.defaultView;
  while (node)
  {
    if (node.nodeType == node.ELEMENT_NODE)
    {
      var display = v.getComputedStyle(node, "").getPropertyValue('display');
      if (display == 'block' || display == 'table-cell' || display == 'table-caption' || display == 'list-item')
        return node;
    }
    node = node.parentNode;
  }
  return node;
}


function ApplyToSelectionBlockElements(evalStr)
{
  var editor = GetCurrentEditor();
  if (!editor)
  {
    alert("Could not acquire editor object.");
    return;
  }

  if (editor.selection.rangeCount > 0)
  {
    editor.beginTransaction();
    try {
    for (i=0; i<editor.selection.rangeCount; ++i)
    {
      var range = editor.selection.getRangeAt(i);
      var node = range.startContainer;
      // walk the tree till we find the endContainer of the selection range,
      // giving our directionality style to everything on our way
      do
      {
        var closestBlockElement = findClosestBlockElement(node);
        if (closestBlockElement)
        {
          eval(evalStr);
        }
        else
          break;

        // This check should be placed here, not as the 'while'
        // condition, to handle cases where begin == end
        if (node == range.endContainer)
          break;

        // Traverse through the tree in order
        if (node.firstChild)
          node = node.firstChild;
        else if (node.nextSibling)
          node = node.nextSibling;
        else
          // find a parent node which has anything after
          while (node = node.parentNode)
          {
            if (node.nextSibling)
            {
              node = node.nextSibling;
              break;
            }
          }
      }
      while(node);
    }
    } finally { editor.endTransaction(); }
  }
}

function ClearParagraphDirection()
{
  var evalStr = 'editor.removeAttribute(closestBlockElement, \'dir\');';
  ApplyToSelectionBlockElements(evalStr);
}


function SetParagraphDirection(dir)
{
  var evalStr = 'editor.setAttribute(closestBlockElement, \'dir\', \'' + dir + '\');';
  ApplyToSelectionBlockElements(evalStr);
}

function SwitchParagraphDirection()
{
  var evalStr =
    'var dir = (closestBlockElement.ownerDocument.defaultView.getComputedStyle(closestBlockElement, "").getPropertyValue("direction") == "rtl"? "ltr" : "rtl");' +
    'editor.setAttribute(closestBlockElement, \'dir\', dir);';
  ApplyToSelectionBlockElements(evalStr);
}


function onKeyPress(ev)
{
  // Don't change the behavior for text-plain messages
  var editorType = GetCurrentEditorType();
  if (editorType != 'htmlmail')
    return;

  // Steal all Enters but Shift-Enters. Shift-Enters should insert BR, as usual.
  if ((ev.keyCode == KeyEvent.DOM_VK_ENTER || ev.keyCode == KeyEvent.DOM_VK_RETURN) && !ev.shiftKey)
  {
    // Do whatever it takes to prevent the editor from inserting a BR
    ev.preventDefault();
    ev.stopPropagation();
    ev.initKeyEvent("keypress", false, true, null, false, false, false, false, 0, 0);

    // ... and insert a paragraph break instead
    InsertParagraph();
  }
}

// Will attempt to break the current line into two paragraphs (unless we're in a list).
function InsertParagraph()
{
  var editor = GetCurrentEditor();
  if (!editor)
  {
    alert("Could not acquire editor object.");
    return;
  }

  editor.beginTransaction();
  // Avoid mangling LIs and different kinds of paragraphs
  if (!editor.selection.isCollapsed)
   editor.deleteSelection(editor.eNone);

  var isParMixed = new Object;
  var isListMixed = new Object;
  var isListOl = new Object;
  var isListUl = new Object;
  var isListDl = new Object;
  var parState;
  parState = editor.getParagraphState(isParMixed);
  editor.getListState(isListMixed, isListOl, isListUl, isListDl);

  if ((parState == "") && !isListOl.value && !isListUl.value && !isListDl.value)
    editor.setParagraphFormat("p");
  editor.insertLineBreak();
  if (!isListOl.value && !isListUl.value && !isListDl.value)
   editor.setParagraphFormat("p");

  editor.endTransaction();
}

var directionSwitchController =
{
  supportsCommand: function(command)
  {
    switch (command)
    {
      case "cmd_rtl_paragraph":
      case "cmd_ltr_paragraph":
      case "cmd_rtl_document":
      case "cmd_ltr_document":
      case "cmd_switch_paragraph":
      case "cmd_switch_document":
      case "cmd_clear_paragraph_dir":
        return true;
      default:
        return false;
    }
  },

  isCommandEnabled: function(command)
  {
    var rv = true;
    // and now for what this function is actually supposed to do...
    switch (command)
    {
      case "cmd_switch_paragraph":
      case "cmd_clear_paragraph_dir":
      case "cmd_rtl_paragraph":
      case "cmd_ltr_paragraph":
      case "cmd_rtl_document":
      case "cmd_ltr_document":
      case "cmd_switch_document":
        // editor focused?
        rv = (content == top.document.commandDispatcher.focusedWindow);

        // due to the ridiculous design of the controller interface,
        // the isCommandEnabled function has side-effects! and we
        // must use it to update button states because no other
        // method gets called to do that
        this.setCaster(command);
        break;
      default:
        rv = false;
    }

    return rv;
  },

  getState: function(command)
  {
    var dir;

    switch (command)
    {
      case "cmd_rtl_paragraph":
        dir = GetCurrentParagraphDirection();
        if (dir == 'rtl')
          return 'checked';
        else
          return 'unchecked';
      case "cmd_ltr_paragraph":
        dir = GetCurrentParagraphDirection();
        if (dir == 'ltr')
          return 'checked';
        else
          return 'unchecked';
      // the body dir is always set either to ltr or rtl
      case "cmd_rtl_document":
        return ((document.getElementById('content-frame').contentDocument.body.dir == 'rtl') ? 'checked' : 'unchecked');
      case "cmd_ltr_document":
        return ((document.getElementById('content-frame').contentDocument.body.dir == 'ltr') ? 'checked' : 'unchecked');
    }
    return null;
  },

  setCaster: function(command)
  {
    switch (command)
    {
      case "cmd_rtl_paragraph":
        caster = 'rtl-paragraph-direction-broadcaster';
        break;
      case "cmd_ltr_paragraph":
        caster = 'ltr-paragraph-direction-broadcaster';
        break;
      case "cmd_rtl_document":
        caster = 'rtl-document-direction-broadcaster';
        break;
      case "cmd_ltr_document":
        caster = 'ltr-document-direction-broadcaster';
        break;
      default:
        return;
    }
    var state = this.getState(command);

    document.getElementById(caster).setAttribute('checked', (state == 'checked') );
    document.getElementById(caster).setAttribute('disabled', (content != top.document.commandDispatcher.focusedWindow) );
  },

  setAllCasters: function()
  {
    this.setCaster("cmd_ltr_document");
    this.setCaster("cmd_rtl_document");
    this.setCaster("cmd_ltr_paragraph");
    this.setCaster("cmd_rtl_paragraph");
  },

  doCommand: function(command)
  {
    switch (command)
    {
      case "cmd_rtl_paragraph":
        SetParagraphDirection('rtl');
        break;
      case "cmd_ltr_paragraph":
        SetParagraphDirection('ltr');
        break;
      case "cmd_rtl_document":
        SetDocumentDirection('rtl');
        break;
      case "cmd_ltr_document":
        SetDocumentDirection('ltr');
        break;
      case "cmd_switch_paragraph":
        SwitchParagraphDirection();
        break;
      case "cmd_switch_document":
        SwitchDocumentDirection();
        break;
      case "cmd_clear_paragraph_dir":
        ClearParagraphDirection();
        break;
      default:
        return false;
    }
    this.setAllCasters();
  }
}