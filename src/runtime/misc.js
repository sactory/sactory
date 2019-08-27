var SactoryConfig = require("./config");
var SactoryContext = require("./context");
var SactoryObservable = require("./observable");

var Sactory = {};

function Attr(args) {
	this.args = args;
	this.length = args.length;
	for(var i in args) {
		this[i] = args[i];
	}
}

Attr.prototype.get = function(index){
	return this.args[index];
};

Attr.prototype.slice = function(){
	return new Attr(Array.prototype.slice.apply(this.args, arguments));
};

Attr.prototype.split = function(separator){
	var ret = [];
	var curr;
	var push = value => {
		if(!curr) ret.push(curr = []);
		curr.push(value);
	};
	this.args.forEach(arg => {
		if(typeof arg == "function") {
			push(arg);
		} else {
			var splitted = (arg + "").split(separator);
			if(splitted.length) {
				if(!splitted[0].length) {
					curr = null;
					splitted.shift();
				}
				var last = splitted.pop();
				splitted.forEach(value => {
					push(value);
					curr = null;
				});
				if(last.length) push(last);
			}
		}
	});
	return ret.map(a => new Attr(a));
};

Attr.prototype.toValue = function(){
	return this.args.length == 1 ? this.args[0] : this.toString();
};

Attr.prototype.toString = function(){
	return this.args.join("");
};

function BuilderObservable(fun, dependencies) {
	this.fun = fun;
	this.dependencies = dependencies;
}

BuilderObservable.prototype.use = function(bind){
	var ret = SactoryObservable.coff(this.fun);
	ret.addDependencies(this.dependencies, bind);
	return ret;
};

/**
 * Checks whether the given version in compatible with the runtime version.
 * @throws {Error} When the given version is not compatible with the runtime version and `warn` is not true.
 * @since 0.32.0
 */
Sactory.check = function(version, warn){
	var transpiled = version.split('.');
	var runtime = Sactory.VERSION.split('.');
	if(transpiled[0] != runtime[0] || transpiled[1] != runtime[1]) {
		if(warn) {
			console.warn(`Code transpiled using version ${version} may not work properly in the current runtime environment using version ${Sactory.VERSION}.`);
		} else {
			throw new Error(`Code transpiled using version ${version} cannot be run in the current runtime environment using version ${Sactory.VERSION}.`);
		}
	}
};

/**
 * @since 0.32.0
 */
Sactory.unique = function(scope, {element}, id, fun){
	var className = SactoryConfig.config.prefix + id;
	if(!(element && element.ownerDocument || document).querySelector("." + className)) {
		var ret = fun.call(scope);
		ret.__builder.addClass(className);
		return ret;
	}
};

/**
 * @since 0.120.0
 */
Sactory.inherit = function(target, ...args){
	// the last two options (widget and namespace) are assigned only if
	// the target does not have them and the inheritance does
	for(var i=4; i<=6; i++) {
		if(target[i] === undefined) {
			args.forEach(arg => {
				var value = arg[i];
				if(value !== undefined) target[i] = value;
			});
		}
	}
	// the first four options are arrays and are merged in reverse so
	// the more the inherit tag was the less important is
	args.reverse().forEach(options => {
		for(var i=0; i<Math.min(4, options.length); i++) {
			var option = options[i];
			if(option) {
				if(target[i]) target[i].unshift(...option);
				else target[i] = option;
			}
		}
	});
	return target;
}

/**
 * @since 0.78.0
 */
Sactory.on = function(scope, context, name, value){
	if(arguments.length == 5) {
		arguments[2].__builder.event(scope, arguments[3], arguments[4], context.bind);
	} else {
		context.element.__builder.event(scope, name, value, context.bind);
	}
};

/**
 * @since 0.130.0
 */
Sactory.$$on = function(context1, context2, element, name, value){
	element.__builder.event(null, name, value, SactoryContext.context(context1, context2).bind);
};

/**
 * @since 0.127.0
 */
Sactory.attr = function(...args){
	return new Attr(args);
};

/**
 * @since 0.129.0
 */
Sactory.bo = function(fun, dependencies, maybeDependencies){
	if(maybeDependencies) {
		Array.prototype.push.apply(dependencies, maybeDependencies.filter(SactoryObservable.isObservable));
	}
	if(dependencies.length) {
		return new BuilderObservable(fun, dependencies);
	} else {
		return fun();
	}
};

/**
 * @since 0.129.0
 */
Sactory.isBuilderObservable = function(value){
	return value instanceof BuilderObservable;
};

var currentId;

/**
 * @since 0.70.0
 */
Sactory.nextId = function({counter}){
	return currentId = counter.nextPrefix();
};

/**
 * @since 0.70.0
 */
Sactory.prevId = function(){
	return currentId;
};

/**
 * @since 0.98.0
 */
Sactory.forEach = function(scope, value, fun){
	if(value.forEach) {
		value.forEach(fun.bind(scope));
	} else {
		// assuming it's an object
		var index = 0;
		for(var key in value) {
			fun.call(scope, key, value[key], index++, value);
		}
	}
};

/**
 * @since 0.98.0
 */
Sactory.range = function(scope, from, to, fun){
	if(from < to) {
		for(var i=from; i<to; i++) {
			fun.call(scope, i);
		}
	} else {
		for(var i=from; i>to; i--) {
			fun.call(scope, i);
		}
	}
};

/**
 * @since 0.93.0
 */
Sactory.ready = function(callback){
	if(document.readyState == "complete") {
		callback();
	} else {
		window.addEventListener("load", callback);
	}
};

/* debug:
Object.defineProperty(Sactory, "isDebug", {
	value: true
});

var debugTitle;
var debugging = false;

var help = "Available commands:\n\
  bind: Show a map of the whole binding system.\n\
  help: Show this message.\n\
"

Object.defineProperty(Sactory, "debug", {
	get: function(){
		if(!debugging) {
			debugging = true;
			Object.defineProperty(window, "bind", {
				get: function(){
					function make(bind) {
						return {
							elements: bind.elements,
							subscriptions: bind.subscriptions,
							children: bind.children.map(make)
						};
					}
					return make(Sactory.bindFactory);
				}
			});
			Object.defineProperty(window, "help", {
				get: function(){
					console.log(help);
				}
			});
			debugTitle.textContent = box + help + "\n";
			console.log(help);
		}
	}
});

var box = "\n\n\
╭─╴ ╭─╮ ╭─╴ ─┬─ ╭─╮ ╭─╮ ╷ ╷ \n\
╰─╮ ├─┤ │    │  │ │ ├┬╯ ╰┬╯ \n\
╶─╯ ╵ ╵ ╰─╴  ╵  ╰─╯ ╵╰   ╵  \n\
";

if(typeof window == "object") {
	for(var i=26-Sactory.VERSION.length; i>0; i--) {
		box += " ";
	}
	box += "v" + Sactory.VERSION + "\n\n";
	Sactory.ready(function(){
		document.insertBefore(debugTitle = document.createComment(box + "Type Sactory.debug in the\nconsole to start debugging.\n\n"), document.documentElement);
	});
}
*/

module.exports = Sactory;