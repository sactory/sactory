var Sactory = {};

var mac = typeof window == "object" && window.navigator.platform.indexOf("Mac") != -1;

var cmd = mac ? "meta" : "ctrl";

/**
 * @since 0.64.0
 */
Sactory.config = {
	prefix: "sa",
	shortcut: {
		cmd: cmd,
		save: "keydown:" + cmd + ":key-code.83",	// s
		copy: "keydown:" + cmd + ":key-code.67",	// c
		cut: "keydown:" + cmd + ":key-code.88",		// x
		paste: "keydown:" + cmd + ":key-code.86",	// v
		print: "keydown:" + cmd + ":key-code.80",	// p
		undo: "keydown:" + cmd + ":key-code.90",	// z
		redo: "keydown:" + cmd + ":key-code.89",	// y
		find: "keydown:" + cmd + ":key-code.70",	// f
		select: "keydown:" + cmd + ":key-code.65",	// a
	},
	event: {
		aliases: {
			"space": " ",
			"ctrl": "control",
			"column": ":",
			"dot": "."
		}
	}
};

Sactory.newPrefix = function(){
	return Sactory.config.prefix + Math.floor(Math.random() * 100000);
}

module.exports = Sactory;
