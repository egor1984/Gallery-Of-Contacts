/*
 * var graph = new Graph();

var renderer = function(r,node) {
	var color = Raphael.getColor();
		set = r.set().push(r.image("http://cs9491.vkontakte.ru/u17835/e_e5ecf9e4.jpg", node.point[0], node.point[1], 30, 30)
				.attr({"href":"http://vkontakte.ru/id15325510","target":"_top"})
		);
	return set;
};




//var contact_text_color = app_user.friends[uid] ? "#4cbf9c" : "#aaaaaa";
graph.addNode("111",{render:renderer});		


var layouter = new Graph.Layout.Spring(graph);
layouter.layout();
 

graph.edges.splice(0,graph.edges.length);

var renderer = new Graph.Renderer.Raphael('canvas', graph, 106, 100);
renderer.draw();
*/

setTimeout( function() {
	
var el = document.createElement("image");
el.setAttribute("x", "20");
el.setAttribute("y", "20");
el.setAttribute("width", "30");
el.setAttribute("heigth", "30");
el.setAttribute("preserveAspectRatio","none");
//el.setAttributeNS("http://www.w3.org/1999/xlink","href", "http://cs9491.vkontakte.ru/u17835/e_e5ecf9e4.jpg");
document.getElementById("canvas").appendChild(el);

/*    
var r = Raphael("canvas", 106, 100);
var image = r.image("http://cs9491.vkontakte.ru/u17835/e_e5ecf9e4.jpg", 20, 20, 30, 30);
image.attr("href","http://vkontakte.ru/id15325510")
image.attr("target","_blank");
*/
}, 2000);
/*
image.node.onclick = function() {
	alert("kuku");
}

*/