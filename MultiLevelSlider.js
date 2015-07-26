(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery','backbone','require'], factory);
    } else {
        // Browser globals
        root.amdWeb = factory(root.b);
    }
}(this, function ($,Backbone,require) {

	var Generator = function(){
		Generator.prototype.genMenu = function(opts) {
			var div = document.createElement('div');
			div.className = typeof opts.defaultMenuClasses !== "undefined" ? opts.defaultMenuClasses : 
				"icon-preview slider-menu";
			var i = document.createElement('i');
			i.className = "mdi-action-list";
			div.appendChild(i);

			var ret = opts.menuCreatedCallback && opts.menuCreatedCallback(div);
			if (typeof ret !== "undefined"){
				div = ret;
			}
			return div;
		}



		Generator.prototype.genSlider = function(opts) {
			var panel = document.createElement('div');
			var heading = document.createElement('div');
			var content = document.createElement('div');

			panel.className = typeof opts.defaultSliderClasses !== "undefined" ? opts.defaultSliderClasses :
				"panel panel-default panel-menu-left nav-transitions hide-left";

			heading.className = "panel-heading";
			content.className = "panel-body slider-body";

			panel.appendChild(heading);
			heading.appendChild(content);

			opts.sliderCreatedCallback && opts.sliderCreatedCallback(panel, heading, content);
			
			return panel;

		}

		Generator.prototype.genShim = function(opts){
			var shim = document.createElement('div');

			shim.className = typeof opts.defaultShimClasses !== "undefined" ? opts.defaultShimClasses :
				"shim fade";

			$('body')[0].appendChild(shim);

			opts.shimCreatedCallback && opts.shimCreatedCallback(shim);
			return shim;
		}
	}

	var Navigator = function(){
		
		Navigator.prototype.findUpperElem = function(elem, needle, property){
        
        if (elem.tagName === "BODY"){
          return false;
        }
        else if (typeof elem.parentNode === "undefined"){
          return false;
        }
        var nextElem = $(elem).next()[0];
        if (typeof nextElem === "undefined"){
          nextElem = elem;
        }
        if (property){
        	if (nextElem[property] !== needle){
          		return this.findNextElem(nextElem.parentNode, needle,property);
	        }
	        //must equal needle
	        else{
	          return nextElem;
	        }
        }
        else {
        	if (nextElem.tagName !== needle){
          		return this.findNextElem(nextElem.parentNode, needle);
	        }
	        //must equal needle
	        else{
	          return nextElem;
	        }
        }
        
      }
      
      Navigator.prototype.findNextElem = function(elem, needle){
      	var ret = null;
      	for (var i = 0; i < elem.children.length; i++) {
      		if (elem.children[i].tagName == needle){
      			ret = elem.children[i];
      		}
      	}
      	return ret;
      }

      Navigator.prototype.BFS = function(start, needle){

      	var q = [];
      	q.push(start);
      	
      	while (q.length != 0){
      		var elem = q.shift();
      		
      		var href = elem.href || elem.getAttribute("href");
      		if ((typeof href !== "undefined" || href != null)
      			&& href == needle){
      			return elem;
      		}
      		for (var i = 0; i < elem.children.length; i++) {
      			q.push(elem.children[i]);
      		}
			

      	}
      	return false;
      	
  	}


  }

	

	var HistoryItem = function(href,nav){
		this.href = href;
		this.nav = nav;
	}
	/*
	{	
		//if menu is supplied, menuCreatedCallback is not called as menu is not generated
		menu: selector / dom elem

		//
		slider: selector / dom elem
	
		//shim when menu is open
		shim: selector / dom elem

		//menu classes to apply on default
		defaultMenuClasses: String

		//slider classes to apply on default
		defaultSliderClasses: String

		defaultShimClasses: String

		defaultShimFadeClass: String

		defaultShimFadeOpacity: Float

		defaultTransformX: Int

		//slider transitions classes to apply on default
		defaultSliderTransitionClasses: String / default: nav-transition

		//called before slider is created, before attach to body
		sliderCreatedCallback: function,

		//called before menu is created, before attach to body
		menuCreatedCallback: function
	
		//called when shim is created, before attach to body
		shimCreatedCallback: function


	}

	Button attributes:
		prevent: prevents searching for sub nav
		prevent-default: executes e.preventDefault() on the event
		stop-propagation: executes e.stopPropagation() on the event
		change-hash: changes the window.hash property according to href (assumes a elem not used)
	*/
	var MultiLevelSlider = function(opts){
		var zIndexCounter = 1003;
		var currNav = null;
		var historyStack = [];

		var dontAppendMenu = false;
		var dontAppendSlider = false;
		var dontAppendShim = false;

		var generator = new Generator();
		var navigator = new Navigator();

		var defaultTransformX = typeof opts.defaultTransformX !== "undefined" ? opts.defaultTransformX + "px" :
			"250px";

		this.state = {
			opened: false
		};

		opts = opts || {};

		var menu = typeof opts.menu !== "undefined" ? opts.menu : generator.genMenu(opts);

		if (typeof menu === "string"){
			dontAppendMenu = true;
			menu = $(menu)[0];
		}

		var slider = typeof opts.slider !== "undefined" ? opts.slider : generator.genSlider(opts);

		if (typeof slider === "string"){
			dontAppendSlider = true;
			slider = $(slider)[0];
		}

		var shim = typeof opts.shim !== "undefined" ? opts.shim : generator.genShim(opts);

		if (typeof shim === "string"){
			dontAppendShim = true;
			shim = $(shim)[0];
		}

		var body = $('body')[0];

		if (!dontAppendMenu){
			body.appendChild(menu);
		}

		if (!dontAppendSlider){
			body.appendChild(slider);
		}

		if (!dontAppendShim){
			body.appendChild(shim);
		}

		slider.style.zIndex = zIndexCounter;
		zIndexCounter++;

		shim.style.display = "none";

		var self = this;

		//listeners
		menu.addEventListener("click",function(e){
			e.stopPropagation();
			self.open();
		},false);

		shim.addEventListener("click", function(e){
			e.stopPropagation();
			
			self.close();
			slider.addEventListener("transitionend",function(e){
				
				self.reset();
				
				slider.removeEventListener("transitionend",arguments.callee);
			},false);
			
		}, false);

		
		slider.addEventListener("click", function(e){
			e.stopPropagation();
			
			var href = e.target.href || e.target.getAttribute("href");
			var prevent = e.target.getAttribute("prevent");
			var pDefault = e.target.getAttribute("prevent-default");
			var prop = e.target.getAttribute("stop-propagation");
			var hash = e.target.getAttribute("change-hash");
			
			if (pDefault != null){
				e.preventDefault();
			}

			if (prop != null){
				e.stopPropagation();
			}

			if (hash != null && href != null){
				window.hash = href;
			}

			if (prevent != null){
				return;
			}

			

			

			if (typeof href !== "undefined"){
				
				if (href == null){
					return;
				}
				href = href.replace("#","");
				if (href == "Back" || href == "back"){
					self.back();
				}
				else {
					self.forward(e.target,href);
				}
			}
		},false);


		MultiLevelSlider.prototype.forward = function(elem,href,override){
			
			var nextElem = navigator.findNextElem(elem, "NAV");
			if (nextElem == null){
				console.warn("No child NAV found at ", elem);
				return false;
			}

			if (currNav == null && !override){
				currNav = slider;
				var historyItem = new HistoryItem(href, currNav);
				historyStack.push(historyItem);
			}
			else if (!override){
				var historyItem = new HistoryItem(href, currNav);
				historyStack.push(historyItem);
			}
			


		

			

			nextElem.classList.remove("move-left");
			if (override){
				nextElem.style.transform = "translateX("+defaultTransformX+")";
			}

			
			nextElem.style.zIndex = zIndexCounter;
			zIndexCounter++;

			currNav = nextElem;

			

		}

		MultiLevelSlider.prototype.back = function(){
			zIndexCounter--;

			/*
			var nextElem = navigator.findUpperElem(elem,"NAV");
			if (nextElem == null){
				console.warn("No upper NAV found at ", elem);
				return false;
			}
			*/

			var historyItem = historyStack.pop();
			
			if (typeof historyItem !== "undefined"){
				currNav.classList.add("move-left");
			
				//currNav.classList.toggle("hidden-nav");

				currNav = historyItem.nav;
			}
			else {
				this.reset();
				this.close();
			}

			


		}

		MultiLevelSlider.prototype.reset = function(){
			
			
			while (historyStack.length != 0){
				zIndexCounter--;
				var hist = historyStack.pop();
				if (hist.nav == slider){

				}
				else {
					hist.nav.classList.add("move-left");
				}
			}
			if (currNav != null){
				if (currNav != slider){
					currNav.style.removeProperty('transform');
					
				}
				currNav.classList.add("move-left");
				currNav = null;	
			}
			
		}

		MultiLevelSlider.prototype.goTo = function(id){
			var elem = navigator.BFS(slider,id);
			if (elem){
				
				if (!this.state.opened){
					this.open(false);
					
					var href = elem.href || elem.getAttribute("href");
					href = href.replace("#","");

					
					this.forward(elem,href,true);
					
					
				}
				else {
					/*
					var href = elem.href || elem.getAttribute("href");
					href = href.replace("#","");

					this.forward(elem,href);
					*/
				}
				
			}
			else {
				throw new Error(id + " not found.");
				
			}
		}



		MultiLevelSlider.prototype.add = function(){

		}

		MultiLevelSlider.prototype.open = function(root){
			this.state.opened = true;
			
			if (typeof root === "undefined" || root === true){
				slider.classList.toggle("move-left");		
			}
			
			
			
			shim.style.display = "block";
			shim.style.opacity = opts.defaultShimFadeOpacity || ".5";

		}

		MultiLevelSlider.prototype.close = function(){
			console.log(window.hash);
			this.state.opened = false;
			shim.style.display = "none";

			if (currNav != null && currNav != slider && historyStack.length == 0){
				
				currNav.classList.add("move-left");
				currNav.style.removeProperty('transform');
			}	
			else {
				slider.classList.add("move-left");	
			}

			
			shim.style.opacity = "0";
		}
		return this;
	}
	return MultiLevelSlider;
}));