

setTimeout( function() {
	
}, 500);

function get_contact_url( uid) {
	return "http://vkontakte.ru/id" + uid;
}

var friends_loader = new contact_loader("execute", function(details_requests) {
			var code = "var ret = [";
			for (var i = 0; i < details_requests.length; i++) {
				if (i!=0) {
					code += ",";
				}
				code += "API.friends.get({uid:" + details_requests[i].contact.uid
									+ "})";
			}				
			code += "]; return ret;";
			return {api_id:"1918079",code:code,v:"3.0"};			
		}, function(contact,response) {
			contact.friends = {};
			for (var uid_index=0;uid_index<response.length;uid_index++) {
				contact.friends[response[uid_index]]=true;
			}		
		},24);

var profile_loader = new contact_loader("getProfiles", function(details_requests) {
			var uids = "";
			for (var i = 0; i < details_requests.length; i++) {
				if (i!=0) {
					uids += ",";
				}
				uids += details_requests[i].contact.uid;
			}				
			return {uids:uids, fields:"uid,first_name,photo"};
		}, function(contact,response) {
			for (var key in response){
				if (key != "uid") {
					contact[key] = response[key];
				}
			}
		
		},240);
		
setInterval( function() {
	if (friends_loader.queue.length != 0) {
		friends_loader.send_next_request();
	}
	else
	{
		if (profile_loader.queue.length != 0) {
			profile_loader.send_next_request();
		}
	}
}, 400);


var call_counter = 0;
var l = -1;
var clusters = new Array();
var loaded_contacts = {};


function get_app_user_uid()	{
//return 5843475;
//return 14769060;
//return 3469711;
//return 1895846;
//return 4430857;
//return 35050772;
	return Number(getUrlParameter(window.location.href, "user_id")); 	
}


function indexOf(arr, pred) {
	var index = 0;
	while (index < arr.length && !pred(arr[index])) {
		index++;
	}
	if (index == arr.length) {
		return -1;
	}
	return index;
}

function is_friends( contact1, contact2) {
// Contacts can hide their friends information, so we will check both of them
	return (contact1.friends && contact1.friends[contact2.uid])
			|| (contact2.friends && contact2.friends[contact1.uid]);
}




function uids_are_friends( uid1, uid2) {
// Contacts can hide their friends information, so we will check both of them
	var contact1 = loaded_contacts[uid1];
	var contact2 = loaded_contacts[uid2];

	return (contact1 && contact1.friends && contact1.friends[uid2])
			|| (contact2 && contact2.friends && contact2.friends[uid1]);
}


function find_distinct_values(uids1,uids2) {
	//we assume groups members are sorted
	
	var distinct_values = new Array();
	
	var index1 = 0;
	var index2 = 0;
	while (index1 < uids1.length || index2 < uids2.length) {
		if (index1>=uids1.length) {
			distinct_values.push(uids2[index2]);
			index2++;
		} else {
			if (index2>=uids2.length) {
				distinct_values.push(uids1[index1]);
				index1++;
			} else { 
				if (uids1[index1] < uids2[index2]) {
					distinct_values.push(uids1[index1]);
					index1++;
				} else {
					if (uids1[index1] > uids2[index2]) {
						distinct_values.push(uids2[index2]);
						index2++;
					} else {
						if (uids1[index1] == uids2[index2]) {
							index1++;
							index2++;
						}
					}
				}
			}
		}
	
	}
	
	return distinct_values;
}


function merge_unique(uids1, uids2) {
	//we assume groups members are sorted
	
	var uniques = new Array();
	
	var index1 = 0;
	var index2 = 0;
	while (index1 < uids1.length || index2 < uids2.length) {
		var next_uid;
		if (index1 < uids1.length && (index2 >= uids2.length || uids1[index1] < uids2[index2])) {
			next_uid = uids1[index1];
			index1++;
		} else {
			next_uid = uids2[index2];
			index2++;
		}
		if (uniques.length == 0 || uniques[uniques.length - 1]!=next_uid) {
			uniques.push(next_uid);
		}
	}
	
	return uniques;
}

function concat_members_names(members) {
	var group_name = "";
	for (var n = 0; n < members.length; n++) {
		group_name = group_name + members[n].first_name + (n == (members.length - 1) ? "" : " ");
	}
	return group_name;
}
function merge_to_next_size(groups){
	var groups_of_next_size = {};
	for (var index1=0;index1<groups.length;index1++){
		var group1 = groups[index1];
		for (var index2=index1+1;index2<groups.length;index2++){
			var group2 = groups[index2];
			var distinct_values = find_distinct_values(group1.uids,group2.uids);
			if (distinct_values.length==2 && uids_are_friends(distinct_values[0],distinct_values[1])){
				group1.used_in_merged = true;
				group2.used_in_merged = true;
				var uids = merge_unique(group1.uids,group2.uids);
				var group_of_next_size = new Object({uids:uids,used_in_merged:false});
				
				groups_of_next_size[uids] = group_of_next_size;
			}
		}
	}
	var groups_array = new Array();
	for (var group_key in groups_of_next_size) {
		groups_array.push(groups_of_next_size[group_key]);
	}
	return groups_array;
}


function index_of_same_group(groups,group_1) {
	return indexOf(groups,function(group) {
			if (group_1.uids.length !=group.uids.length){
				return false;
			}
			for (var member_index=0;member_index<group.uids.length;member_index++) {
				if (group_1.uids[member_index]!=group.uids[member_index]){
					return false;
				}
			}
			return true;
		});
}
	
function merge_groups(group_size_begin,group_size_end,groups_for_merge) {
	var all_merged_groups = new Array();
	for (var i=group_size_begin;i<=group_size_end;i++) {
		var tmp_groups_for_merge = merge_to_next_size(groups_for_merge);
		for (var j = 0; j < groups_for_merge.length;j++) {
			if (!groups_for_merge[j].used_in_merged) {
				all_merged_groups.push(groups_for_merge[j]);
			}
		}
		groups_for_merge = tmp_groups_for_merge;
	}	
	for (var i = 0; i < groups_for_merge.length;i++) {
		all_merged_groups.push(groups_for_merge[i]);
	}
	return all_merged_groups;
}
	

	
function find_dublicates_in_sorted_arrays(array_1,array_2,comparator) {
	var dublicates = new Array();
	var index_1 = 0;
	var index_2 = 0;
	while (index_1 < array_1.length && index_2 < array_2.length) {
		var compare_result = comparator(array_1[index_1],array_2[index_2]);
		if (compare_result == 0) {
			dublicates.push(array_1[index_1]);
			index_1++;
			index_2++;
		}
		else {
			if (compare_result < 0) {
				index_1++;
			}
			else {
				index_2++;
			}
		}
	}
	return dublicates;
}
	
	
function find_triples(iteration_list,use_contacts_without_friends) {
	var groups_3 = new Array();
	
	
	for (var i = 0; i < iteration_list.length; i++) {
		var friend1 = iteration_list[i];
		for (var j = i+1; j < iteration_list.length;j++) {
			var friend2 = iteration_list[j];
			if (is_friends(friend1,friend2)) {
				for (var uid  in friend1.friends){
					if (friend2.friends[uid] && ( use_contacts_without_friends || (loaded_contacts[uid] && loaded_contacts[uid].friends))) {
						var triple = new Array();
						triple.push(friend1.uid);
						triple.push(friend2.uid);
						triple.push(Number(uid));
						triple.sort(function(uid_1,uid_2) { return uid_1 - uid_2;});
						

						var group = new Object({uids: triple,used_in_merged:false});
						if (index_of_same_group(groups_3,group)==-1) {
							groups_3.push(group);
						}
					}
				}	
			}
		}
	}


	
	return groups_3;
}
	
function get_distinct_uids(groups){
	var uids = {};
	for (var i = 0; i<groups.length;i++) {
		for (var j = 0;j<groups[i].uids.length;j++) {
			var uid = groups[i].uids[j];
			uids[uid] = true;
		}
	}
	return uids;
}


function get_substracted_array(substractable,substraction) {
	
	var substractable_as_object = {};
	for (var element_index = 0; element_index < substractable.length;element_index++) {
		substractable_as_object[substractable[element_index]] = true;
	}
	for (var element_index=0;element_index<substraction.length;element_index++) {
		delete substractable_as_object[substraction[element_index]];
	}
	var substracted_array = [];
	for (var element in substractable_as_object) {
		substracted_array.push(element);
	}
	substracted_array.sort(function(element_1,element_2) { return element_1 - element_2;});
	return substracted_array;
}


function get_common_uids(groups,group_indexes) {
	var common_uids = [];
	if (group_indexes.length >= 2) {
		common_uids = groups[group_indexes[0]].uids;
		for (var group_indexes_index = 1; group_indexes_index < group_indexes.length; group_indexes_index++) {
			common_uids = find_dublicates_in_sorted_arrays(common_uids,groups[group_indexes[group_indexes_index]].uids
				, function(uid_1,uid_2) { return uid_1 - uid_2;});
		}
	}
	return common_uids;
}


function process_output(user) {
 
	var iteration_list = new Array();
	if (user.friends) {
		iteration_list.push(user);
		for (var uid in user.friends) {
			var friend = loaded_contacts[uid];
			if (friend && friend.friends
				&& indexOf(iteration_list,function(contact) { return contact.uid == friend.uid;})
				== -1) {
				iteration_list.push(friend);
				for (var uid_2 in friend.friends) {
					var friend_of_friend = loaded_contacts[uid_2];
					if (friend_of_friend && friend_of_friend.friends
					&& indexOf(iteration_list,function(contact) { return contact.uid == friend_of_friend.uid;})
					== -1) {
						iteration_list.push(friend_of_friend);
					}
				}
			}
		}
		iteration_list.sort(function(contact1,contact2) { return contact1.uid - contact2.uid;});
	}

	var groups_3 = find_triples(iteration_list,true);

	var extended_contacts = new Array();
	var unloaded_extended_uids = new Array();
	for (var i = 0; i<groups_3.length;i++) {
		for (var j = 0;j<groups_3[i].uids.length;j++) {
			var uid = groups_3[i].uids[j];
			var member = loaded_contacts[uid];
			if (member && member.friends) {
				if (indexOf(extended_contacts,function(contact) { return contact.uid == member.uid;})
					== -1) {
					extended_contacts.push(member);
				}
			} else {
				if (indexOf(unloaded_extended_uids,function(unloaded_uid) { return unloaded_uid == uid;})
					== -1) {
					unloaded_extended_uids.push(uid);
				}
			}
		}
	}

	var counter = 0;
	for (var i = 0; i < unloaded_extended_uids.length; i++) {
		var contact = {uid:Number(unloaded_extended_uids[i])};
		load_friends_of_contact_recursive(contact,0, function(contact) {
			if (contact.friends) {
				extended_contacts.push(contact);
			}
			counter++;
			if ( counter == unloaded_extended_uids.length) {
				var groups_3_2nd = find_triples(extended_contacts,false);
				var groups = merge_groups(4,11,groups_3_2nd);
			
				var uids = get_distinct_uids(groups);
				var profiles_left_to_load = 0;
				for (var uid in uids){
					if (!loaded_contacts[uid]) {
						loaded_contacts[uid] = {uid:uid};
					}
					var contact = loaded_contacts[uid];
					if (!contact.first_name) {
						profiles_left_to_load++;
						profile_loader.queue_request(contact,"uid,first_name,photo", function(contact){
							profiles_left_to_load--;
							if (profiles_left_to_load == 0) {
								refreshGroupList(groups);
							}
						},1);
					}
							
				}
			}
				
				
		}); 
		
	}

	
}





function getUrlParameter(url, parameterName) {
	var param_str = "&" + parameterName + "=";
	
	var val_str_begin = url.indexOf(param_str) + param_str.length;

	var val_str_end = url.indexOf("&", val_str_begin);
	return url.substr(val_str_begin, val_str_end - val_str_begin);
}

//autorun on page load
setTimeout( function() {

	
	VK.Modules.load('md5', function() {
	});
	

	var userContact = {uid:get_app_user_uid()};

	loaded_contacts[userContact.uid] = userContact;

	load_friends_of_contact_recursive(userContact, 1,function(contact) {
		process_output(userContact);
	});
	

}, 1000);

	function load_friends_of_contact_recursive(contact,depth_of_friends_retrival,callback) {
		friends_loader.queue_request( contact, "uid", function( contact, result_msg) {
			if (result_msg == "Success" && contact.friends){
				loaded_contacts[contact.uid] = contact;
			}

			if (result_msg != "Success" || !contact.friends || depth_of_friends_retrival == 0) {
				callback(contact);
				return;
			}
			var friends_details_left_to_load = 0;
			for (var uid in contact.friends) {
				friends_details_left_to_load++;
				var friend = {uid:Number(uid)};
				load_friends_of_contact_recursive(friend,depth_of_friends_retrival - 1,function(loadedContact) {
					friends_details_left_to_load--;
					if (friends_details_left_to_load == 0) {
						callback(contact);
					}
				});
			}
		},1);
	}
		
		
		
function clone_graph_without_node(graph, node_id) {
		var cloned_graph = {};
		for (var connection_node_id in graph) {
			if (connection_node_id != node_id) {
				var connections = [];
				for (var connection_index = 0; connection_index < graph[connection_node_id].connections.length;connection_index++) {
					var connection_id = graph[connection_node_id].connections[connection_index];
					if (connection_id != node_id) {
						connections.push(connection_id);
					}
				}					
				cloned_graph[connection_node_id] = {connections : connections};
			}
		}
		return cloned_graph;
	}
	
	function find_node_with_minimum_connections(graph) {
		var minimum = 0;
		while (true) {
			for (var uid in graph) {
				if (graph[uid].connections.length == minimum) {
					return Number(uid);
				}
			}
			minimum++;
		}
	}
	
	function find_path_with_minimum_new_connections(graph) {
		var segments = [];
		
		while (true) {
			var count_of_nodes = 0;
			for (var id in graph) {
				count_of_nodes++;
				break;
			}
			if (count_of_nodes == 0) {
				break;
			}

			var id_1 = find_node_with_minimum_connections(graph);
			var node_1 = graph[id_1];
			if (node_1.connections.length > 0) {
				var id_2 = node_1.connections[node_1.connections.length - 1];
				node_1.connections.pop();
				graph[id_2].connections.splice(graph[id_2].connections.indexOf(id_1),1);
				segments.push([id_1,id_2]);
				do {
					var segments_are_changed = false;
					for (var segment_index_1 = 0; segment_index_1 < segments.length;segment_index_1++) {
						var segment_1 = segments[segment_index_1];
						if (segment_1[0] == segment_1[segment_1.length - 1]) {
							segment_1.pop();
							segments_are_changed = true;
							break;
						}
						for (var segment_index_2 = 0; segment_index_2 < segments.length;segment_index_2++) {
							if (segment_index_2 != segment_index_1) {
								var segment_2 = segments[segment_index_2];
								if (segment_2[0] == segment_1[0] || segment_2[segment_2.length - 1] == segment_1[segment_1.length - 1]) {
									segment_2.reverse();
								}
								if (segment_2[0] == segment_1[segment_1.length - 1]) {
									segment_1.pop();
//									graph = clone_graph_without_node(graph,segment_1[segment_1.length - 1]);
									graph = clone_graph_without_node(graph,segment_2[0]);
									segments[segment_index_1] = segment_1.concat(segment_2);
									segments.splice(segment_index_2, 1);
									segments_are_changed = true;
									break;
								}
								if (segment_2[segment_2.length - 1] == segment_1[0]) {
									segment_2.pop();
									graph = clone_graph_without_node(segment_1[0]);
									segments[segment_index_1] = segment_2.concat(segment_1);
									segments.splice(segment_index_2,1);
									segments_are_changed = true;
									break;
								}
							}
						}
						if (segments_are_changed) {
							break;
						}
					}		
				} while (segments_are_changed);
			} else {
				graph = clone_graph_without_node(graph, id_1);
			}
		}
		var result = [];
		for (var segment_index = 0;segment_index < segments.length;segment_index++) {
			result = result.concat(segments[segment_index]);
		}
		return result;
	}
	
	function find_path(edges_counter,uids) {
		var existing_segments = {};
		for (var uid_index = 0;uid_index < uids.length; uid_index++) {
			var uid_1 = uids[uid_index];
			var connections = [];
			for (var uid_2_index = 0; uid_2_index < uids.length;uid_2_index++) {
				var uid_2 = uids[uid_2_index];
				if (uid_1 != uid_2 && edges_counter[[uid_1,uid_2]]) {
					connections.push(uid_2);
				}
			}
			existing_segments[uid_1] = {connections : connections};
		}
		var path = find_path_with_minimum_new_connections(existing_segments);
		var unused_elements = get_substracted_array(uids, path);
		return path.concat(unused_elements);
	}
	
	function draw_social_graph(groups) {


		var g = new Graph();
		
		var edges_counter = {};
		var line_counter = 0;
		
		for (var group_index = 0; group_index < groups.length;group_index++) {			
			var group = groups[group_index];
			var skip_group = true;
			for (var uid_index = 0;uid_index < group.uids.length;uid_index++) {
				if (group.uids[uid_index] == get_app_user_uid()) {
					skip_group = false;
				}
			}
			if (skip_group) {
				continue;
			}
			var renderer = function(r,node) {
				var color = Raphael.getColor();

				if (loaded_contacts[node.id] && loaded_contacts[node.id].photo) {
					set = r.set().push(r.image(loaded_contacts[node.id].photo, node.point[0], node.point[1], 30, 30)
					//.attr("href",get_contact_url(node.id))
					);
				}
				else {
					set = r.set().push(r.ellipse(node.point[0], node.point[1], 20, 15).attr({fill: color, stroke: color, "stroke-width": 2}));
				}
                set.push(r.text(node.point[0], node.point[1] + 35, node.label || node.id));
				return set;
			};
			var path = find_path(edges_counter,group.uids);
			for (var path_index=0;path_index<path.length;path_index++) {
				var uid_1 = path[path_index];
				var uid_2 = path[(path_index + 1)%path.length];
				if (uid_1 > uid_2) {
					swap_values(uid_1,uid_2);
				}

					var contact_1 = loaded_contacts[uid_1];
					var contact_1_label = contact_1 && contact_1.first_name ? contact_1.first_name : uid_1;
					g.addNode(uid_1,{render:renderer, label:contact_1_label});
					var contact_2 = loaded_contacts[uid_2];
					var contact_2_label = contact_2 && contact_2.first_name ? contact_2.first_name : uid_2;
					g.addNode(uid_2,{render:renderer,label:contact_2_label});

					if (edges_counter[[uid_1,uid_2]]) {
						edges_counter[[uid_1,uid_2]].push(group_index);
						edges_counter[[uid_2,uid_1]].push(group_index);
					} else {
						edges_counter[[uid_1,uid_2]] = [group_index];
						edges_counter[[uid_2,uid_1]] = [group_index];
						line_counter++;
					};
					var color_number = ((group_index%4 +1)*63 + (div(group_index,4)%4 + 1)*256*63 + (div(group_index,16)%4 + 1)*256*256*63);
					var edge_counter = edges_counter[[uid_1,uid_2]];
					var edge_label = new String(edge_counter);
					g.addEdge(uid_1, uid_2,{ fill : "#" + color_number.toString(16) + "|" + new String(edge_counter.length*2 + 1), label:edge_counter});
			}
		}
		/* layout the graph using the Spring layout implementation */
		var layouter = new Graph.Layout.Spring(g);
		layouter.layout();
		 
		/* draw the graph using the RaphaelJS draw implementation */
		var renderer = new Graph.Renderer.Raphael('canvas', g, 827, 800);
		renderer.draw();
//		alert(line_counter);
	}
	
	function refreshGroupList(groups) {
	
		draw_social_graph(groups);
		
		
	}

	function clearContactDetailsList() {
		var table = document.getElementById("results");
		while (table.firstChild != null) {
			table.removeChild(table.firstChild);
		}
	}

	function addContactToTable(contact) {
		var table = document.getElementById("results");
		var contactDiv = document.createElement("div");
		table.appendChild(contactDiv);
		var contactInnerDiv = document.createElement("div");
		contactInnerDiv.setAttribute("class", "result clearFix");
		contactDiv.appendChild(contactInnerDiv);
		var contactTable = document.createElement("table");
		contactInnerDiv.appendChild(contactTable);
		var contactTableTbody = document.createElement("tbody");
		contactTable.appendChild(contactTableTbody);
		var contactTableTr = document.createElement("tr");
		contactTableTbody.appendChild(contactTableTr);
		var contactTableTd = document.createElement("td");
		contactTableTd.setAttribute("width", 100);
		contactTableTr.appendChild(contactTableTd);
		var contactImageDiv = document.createElement("div");
		contactTableTd.appendChild(contactImageDiv);
		var contactImageAnchor = document.createElement("a");
		
		contactImageAnchor.setAttribute("href", get_contact_url(contact.uid));
		contactImageDiv.appendChild(contactImageAnchor);
		var contactImage = document.createElement("img");
		contactImage.setAttribute("src", contact.photo);
		contactImage.setAttribute("alt", "no photo	");
		contactImageAnchor.appendChild(contactImage);
	}

	
	function setContactDetailsList( uids) {
		clearContactDetailsList();
		for (var uid_index = 0; uid_index < uids.length; uid_index++) {
			var uid = uids[uid_index];
			if (loaded_contacts[uid]) {
				addContactToTable(loaded_contacts[uid]);
			} else {
				addContactToTable({uid:Number(uid),photo:""});
			}
		}
	}
	

