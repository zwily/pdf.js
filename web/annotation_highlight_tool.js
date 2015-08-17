'use strict';

PageViewport.prototype.convertToPdfRectangle =
  function PageViewport_convertToPdfRectangle(rect) {
    var tl = Util.applyInverseTransform([rect[0], rect[1]], this.transform);
    var br = Util.applyInverseTransform([rect[2], rect[3]], this.transform);
    return [tl[0], tl[1], br[0], br[1]];
  }

function convertToRelativeRect(rect, parentRect) {
  return [
    rect[0] - parentRect[0], rect[1] - parentRect[1],
    rect[2] - parentRect[0], rect[3] - parentRect[1]
  ];
}

function convertRectToArray(rect) {
  return [ rect.left, rect.top, rect.right, rect.bottom ];
}

function clearSelection() {
  if (window.getSelection) {
    if (window.getSelection().empty) {  // Chrome
      window.getSelection().empty();
    } else if (window.getSelection().removeAllRanges) {  // Firefox
      window.getSelection().removeAllRanges();
    }
  } else if (document.selection) {  // IE?
    document.selection.empty();
  }
}

var AnnotationAreaTool = {
  initialize: function areaToolInitialize(options) {
    this.active = false;
    this.type = 'area';
    var tool = this.tool = options.toggle;

    // TODO
  }
}

var AnnotationHighlightTool = {
  initialize: function highlightToolInitialize(options) {
    this.active = false;
    this.type = options.type || 'highlight';
    var tool = this.tool = options.toggleAnnotationHighlight;

    tool.addEventListener('click', this.toggle.bind(this), false);

    document.addEventListener('mouseup', function(evt) {
      if (this.active) {
        // TODO: do a correct search up the heirarchy for .page
        var pageNode = evt.target.parentNode.parentNode;
        var page = parseInt(pageNode.dataset.pageNumber);
        var pageIndex = page - 1;

        var viewport = PDFViewerApplication.pdfViewer.getPageView(pageIndex).viewport;
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        var clientRects = range.getClientRects();

        // Chrome seems to have this bug where when there are multiple elements
        // in the selection, and the final block of the selection does not
        // include the entire element, it will include that element as the
        // penultimate in the list, and the partial element as the last. We
        // try to detect that here, and choose the shorter element to keep.
        var n = clientRects.length;
        var skipRectIndex = -1;
        if (n >= 2 &&
            clientRects[n - 1].left === clientRects[n - 2].left &&
            clientRects[n - 1].top === clientRects[n - 2].top) {
          if (clientRects[n - 1].width < clientRects[n - 2].width) {
            skipRectIndex = n - 2;
          } else {
            skipRectIndex = n - 1;
          }
        }

        var textLayer = evt.target.parentNode;
        var parentRect = textLayer.getBoundingClientRect();
        parentRect = convertRectToArray(parentRect);

        var pdfRects = [];
        for (var i = 0; i < clientRects.length; i++) {
          if (i == skipRectIndex) { continue; }
          var rect = clientRects[i];
          var relativeRect = convertToRelativeRect(
            convertRectToArray(rect), parentRect);
          var pdfRect = viewport.convertToPdfRectangle(relativeRect)
          pdfRects.push(pdfRect);
        }

        var boundingRect = convertRectToArray(range.getBoundingClientRect());
        var rBoundingRect = convertToRelativeRect(boundingRect, parentRect);
        var pdfBoundingRect = viewport.convertToPdfRectangle(rBoundingRect);

        var annot = {
          type: this.type,
          page: page,
          rectangles: pdfRects,
          boundingRect: pdfBoundingRect
        };

        CustomAnnotationsManager.add(annot);
        clearSelection();
      }
    }.bind(this));
  },

  toggle: function annotationHighlightToolToggle() {
    this.active = !this.active;

    if (this.active) {
      this.tool.firstElementChild.textContent = 'Disable highlight';
    } else {
      this.tool.firstElementChild.textContent = 'Highlight';
    }

    SecondaryToolbar.close();
  }
};
