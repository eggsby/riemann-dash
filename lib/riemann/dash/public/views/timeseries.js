(function() {
    var fitopts = {min: 6, max: 1000};

    var nameFor = function(event) {
      return event.host + event.service;
    };

    var rateLimit = 750; // ms
  
    var TimeSeriesView = function(json) {

      var self = this;
      
      self.smoothie = new SmoothieChart({
        grid: {strokeStyle:'#ccc', fillStyle:'rgba(255, 255, 255, 0.0)', lineWidth: 1, millisPerLine: 1000},
        labels: { fillStyle:'#262626' }
      });

      var seriesCollection = {};

      var colorTemplate = _.template("hsla(<%=hue%>,<%=saturation%>%,<%=lightness%>%,<%=alpha%>)");

      // throttle data 
      var appendEvent = function(series, event) {
        series.append(event);
        return series.append(new Date(event.time).getTime(), format.float(event.metric));
      };

      var HSLfromString = function(s) {
        // return a hsl triple generated from a string checksum

        var hashCode = function(s) { 
          var hash = 0, char;
          if (s.length == 0) return hash;
          for (i = 0; i < s.length; i++) {
            char = s.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
          }
          return hash;
        }
        
        sum = Math.abs(hashCode(s))

        var hue = sum % 359,
            sat = sum % 101,
            lum = sum % 101;

        while (sat < 35) { sat += 10; }
    
        while (lum > 85) { lum -= 10; }
    
        while (lum < 35) { lum += 10; }

        return [hue, sat, lum];
      };

      var colorStringFromHSL = function(hsl, alpha) {
        return colorTemplate({
          hue: hsl[0],
          saturation: hsl[1],
          lightness: hsl[2],
          alpha: alpha
        });
      };
  
      var createTimeSeries = function(name, event) {
        var seriesColor = HSLfromString(name),
            series = new TimeSeries(),
            color = colorStringFromHSL(seriesColor, 1),
            seriesOpts = {lineWidth: self.lineWidth || 2,
                          strokeStyle: color,
                          fillStyle: colorStringFromHSL(seriesColor, self.opacity || 0)};

        series.appendEvent = _.throttle(function(event) {
          series.append(new Date(event.time).getTime(), format.float(event.metric));
        }, rateLimit);;

         self.smoothie.addTimeSeries(series, seriesOpts);
        return series;
      };

      var intoSeries = function(event) {
        var seriesName = nameFor(event)
        var cachedSeries = seriesCollection[seriesName];

        if (cachedSeries) {
          cachedSeries.appendEvent(event);
        } else {
          var newSeries = seriesCollection[seriesName] = createTimeSeries(seriesName, event);
          newSeries.appendEvent(event);
        };
      };

      view.View.call(this, json);
      this.query = json.query;
      this.title = json.title;
      this.delay = json.delay;
      this.opacity = json.opacity;
      this.lineWidth = json.lineWidth;

      this.clickFocusable = true;
      this.el.addClass('timeseries');
      this.el.append(
        '<div>' +
          '<div class="title">' +
            '<h2>' + this.title + '</h2>' +
          '</div>' +
          '<div class="legend"></div>' +
          '<canvas class="timeseries"></canvas>' +
        '</div>'
      );

      this.$canvas = this.el.find(".timeseries");
      this.$legend = this.el.find(".legend");
      this.$titlecontainer = this.el.find("div.title");
      this.$titlecontainer.css({"color": "#4D4D4D",
                                "font-size": "1.5em"})
      
      this.$title = this.$titlecontainer.find("h2");
      this.canvas = this.$canvas.get(0);

      this.reflow();

      this.smoothie.streamTo(this.canvas, this.delay);      

      if (this.query) {
        this.sub = subs.subscribe(this.query, intoSeries);
      }
    }

    view.inherit(view.View, TimeSeriesView);
    view.TimeSeries = TimeSeriesView;
    view.types.TimeSeries = TimeSeriesView;

    TimeSeriesView.prototype.json = function() {
      return $.extend(view.View.prototype.json.call(this), {
        type: 'TimeSeries',
        title: this.title,
        delay: this.delay,
        query: this.query,
        opacity: this.opacity,
        lineWidth: this.lineWidth,
      });
    }

    TimeSeriesView.prototype.editForm = function() {
      return Mustache.render('<label for="title">Title</label>' +
          '<input type="text" name="title" value="{{title}}" /><br />' +
          '<label for="query">Query</label>' +
          '<textarea type="text" name="query">{{ query }}</textarea><br />' +
          '<label for="lineWidth">LineWidth</label>' +
          '<input type="text" name="stroke width" value="{{lineWidth}}" /><br />' +
          '<label for="opacity">fill opacity</label>' +
          '<input type="text" name="opacity" value="{{opacity}}" /><br />' +
          '<label for="delay">animation delay</label>' +
          '<input type="text" name="delay" value="{{delay}}" />',
        this)
    }

    TimeSeriesView.prototype.reflow = function() {
      // Size metric
      var width = this.el.width();
      var height = this.el.height();
      this.$canvas.attr("width", width - 10);
      this.$canvas.attr("height", height - 10);

    }

    TimeSeriesView.prototype.delete = function() {
      if (this.sub) {
        subs.unsubscribe(this.sub);
      }
      view.View.prototype.delete.call(this);
    }
})();
