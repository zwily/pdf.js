'use strict';

function guid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

window.CustomAnnotationsManager = {
  _annotations: {},

  add: function(options) {
    if (!options.id) {
      options.id = guid();
    }

    this._annotations[options.id] = options;

    var event = document.createEvent('CustomEvent');
    event.initCustomEvent('annotationadded', true, true, {
      annotation: options
    });
    document.dispatchEvent(event);
  },

  getAnnotations: function(page) {
    var result = [];
    for (var id in this._annotations) {
      if (this._annotations.hasOwnProperty(id)) {
        var annot = this._annotations[id];
        if (annot.page === page) {
          result.push(annot);
        }
      }
    }
    return result;
  }
};

var CustomAnnotationsLayer = (function CustomAnnotationsLayerClosure() {
  function CustomAnnotationsLayer(pageView) {
    this.pageView = pageView;
    this.pageDiv = pageView.div;

    document.addEventListener('annotationadded', function(evt) {
      var annot = evt.detail.annotation;
      if (annot.page === this.pageView.id) {
        this.redraw();
      }
    }.bind(this))
  }

  CustomAnnotationsLayer.prototype = {
    redraw: function() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
      }
      // a div that's been detached from the DOM already... do we need to
      // clean anything up so it will be gc'd?

      var div = document.createElement('div');
      div.className = 'customAnnotationsLayer';

      // Our strategy with this layer is to create it at the native width of the
      // PDF page, and then use transforms to scale and rotate it. Therefore,
      // we don't have to convert points for every subelement. We *do* however
      // have to flip Y coordinates since in native PDF, origin is at the bottom
      // left, and our coordinate system here has them top left.

      div.style.width = this.pageView.pdfPage.pageInfo.view[2] + 'px';
      div.style.height = this.pageView.pdfPage.pageInfo.view[3] + 'px';

      var viewport = this.pageView.viewport;

      // Origin will be pinned at top-left so when we scale we still overlay
      // the pdf correctly. Because of that, when rotating we have to translate
      // the div back into position.
      var transX, transY;
      switch (viewport.rotation) {
        case 0:
          transX = transY = 0;
          break;
        case 90:
          transX = 0;
          transY = '-' + div.style.height;
          break;
        case 180:
          transX = '-' + div.style.width;
          transY = '-' + div.style.height;
          break;
        case 270:
          transX = '-' + div.style.width;
          transY = 0;
        default:
          console.error('Bad rotation value');
          break;
      }

      CustomStyle.setProp('transform', div,
        'scale(' + viewport.scale + ',' + viewport.scale + ') ' +
        'rotate(' + viewport.rotation + 'deg) ' +
        'translate(' + transX + ',' + transY + ')');
      CustomStyle.setProp('transformOrigin', div, '0% 0%');

      this.pageDiv.appendChild(div);
      this.div = div;

      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.position = 'relative';
      svg.style.display = 'block';
      this.div.appendChild(svg);

      var annotations = CustomAnnotationsManager.getAnnotations(this.pageView.id);
      for (var i = 0; i < annotations.length; i++) {
        var annot = annotations[i];

        if (annot.type === 'highlight') {
          for (var j = 0; j < annot.rectangles.length; j++) {
            var pdfRect = annot.rectangles[j];
            var rect = pdfRect;

            var r = document.createElementNS(ns, 'rect');
            r.setAttribute('width', Math.abs(rect[2] - rect[0]));
            r.setAttribute('height', Math.abs(rect[3] - rect[1]));
            r.setAttribute('x', Math.min(rect[0], rect[2]));
            r.setAttribute('y', this.pageView.pdfPage.pageInfo.view[3] - Math.max(rect[1], rect[3]));
            r.style.stroke = 'none';
            r.style.fill = '#FFFF00';
            r.style.opacity = '0.25';

            svg.appendChild(r);
          }
        }
      }
    }
  };

  return CustomAnnotationsLayer;
})();

document.addEventListener('pagerendered', function (e) {
  var pageNumber = e.detail.pageNumber;
  var pageIndex = pageNumber - 1;
  var pageView = PDFViewerApplication.pdfViewer.getPageView(pageIndex);

  if (!pageView.customAnnotationsLayer) {
    pageView.customAnnotationsLayer = new CustomAnnotationsLayer(pageView);
  }

  pageView.customAnnotationsLayer.redraw();
});
