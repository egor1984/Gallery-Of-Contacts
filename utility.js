
var MAX_DUMP_DEPTH = 3;

function dumpObj(obj, name, indent, depth) {
       if (depth > MAX_DUMP_DEPTH) {
              return indent + name + ": <Maximum Depth Reached>\n";
       }
       if (typeof obj == "object") {
              var child = null;
              var output = indent + name + "\n";
              indent += "  ";
              for (var item in obj)
              {
                    try {
                           child = obj[item];
                    } catch (e) {
                           child = "<Unable to Evaluate>";
                    }
                    if (typeof child == "object") {
                           output += dumpObj(child, item, indent, depth + 1);
                    } else {
                           output += indent + item + ": " + child + "\n";
                    }
              }
              return output;
       } else {
              return obj;
       }
}	

function div(op1, op2) {
	return(op1 / op2 - op1 % op2 / op2);
}	
