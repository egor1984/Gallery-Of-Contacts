
setTimeout( function() {
}, 500);

function get_contact_url( uid) {
	return "http://vkontakte.ru/id" + uid;
}

var vk_loader = new contact_loader();

var getProfiles_traits = {
		"method_name" : "getProfiles"
		,"parameters_builder" : function(details_requests) {
			var uids = "";
			for (var i = 0; i < details_requests.length; i++) {
				if (i!=0) {
					uids += ",";
				}
				uids += details_requests[i].parameters.contact.uid;
			}				
			return {uids:uids, fields:"uid,first_name,photo"};
		}
		,"response_handler" : function(parameters,response) {
			for (var key in response){
				if (key != "uid") {
					parameters.contact[key] = response[key];
				}
			}
		
		}
		,"max_sum" : 240};


var friends_getMutual_traits = {"method_name" : "execute", "parameters_builder" : function(details_requests) {
		var code = "var ret = [";
		for (var i = 0; i < details_requests.length; i++) {
			if (i!=0) {
				code += ",";
			}
			code += "API.friends.getMutual({target_uid:" + details_requests[i].parameters.contact_1.uid
								+ ", source_uid: " + details_requests[i].parameters.contact_2.uid + "})";
		}				
		code += "]; return ret;";
		return {api_id:"1918079",code:code,v:"3.0"};			
	}
	,"response_handler" : function(parameters,response) {
		if (!parameters.contact_1.mutual_friends) {
			parameters.contact_1.mutual_friends = {};
		}
		if (!parameters.contact_2.mutual_friends) {
			parameters.contact_2.mutual_friends = {};
		}
		if (response.constructor != Array) {
			response = [];
		}
		for (var uid_index = 0;uid_index < response.length;uid_index++) {
			var mutual_friend_uid = response[uid_index];
			if (!parameters.contact_1.mutual_friends[parameters.contact_2.uid]) {
				parameters.contact_1.mutual_friends[parameters.contact_2.uid] = [];
			}
			if (index_of(parameters.contact_1.mutual_friends[parameters.contact_2.uid]
					,mutual_friend_uid) == -1) {
				parameters.contact_1.mutual_friends[parameters.contact_2.uid].push(mutual_friend_uid);					
			}
			if (!parameters.contact_1.mutual_friends[mutual_friend_uid]) {
				parameters.contact_1.mutual_friends[mutual_friend_uid] = [];
			}
			if (index_of(parameters.contact_1.mutual_friends[mutual_friend_uid]
					,parameters.contact_2.uid) == -1) {
				parameters.contact_1.mutual_friends[mutual_friend_uid].push(parameters.contact_2.uid);					
			}
			
		}
	}
	,"max_sum" : 25};


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

function uids_are_friends(user, uid1, uid2) {
// Contacts can hide their friends information, so we will check both of them
				
	return user.mutual_friends 
	&& (user.mutual_friends[uid1] 
	&& index_of(user.mutual_friends[uid1],uid2) != -1 
	|| user.mutual_friends[uid2] && index_of(user.mutual_friends[uid2],uid1) != -1);
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
function merge_to_next_size(user,groups){
	var groups_of_next_size = {};
	for (var index1=0;index1<groups.length;index1++){
		var group1 = groups[index1];
		for (var index2=index1+1;index2<groups.length;index2++){
			var group2 = groups[index2];
			var distinct_values = find_distinct_values(group1.uids,group2.uids);
			if (distinct_values.length==2 && uids_are_friends(user,distinct_values[0],distinct_values[1])){
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
	
function merge_groups(user,group_size_begin,group_size_end,groups_for_merge) {
	var all_merged_groups = new Array();
	for (var i=group_size_begin;i<=group_size_end;i++) {
		var tmp_groups_for_merge = merge_to_next_size(user,groups_for_merge);
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
	
	
function find_triples(user) {
	var groups_3 = new Array();
	
	for (var uid_of_friend_of_user  in user.friends){
		var mutual_friends = user.mutual_friends[uid_of_friend_of_user];
		if (mutual_friends) {
			for (var i = 0; i < mutual_friends.length; i++) {
				var triple = new Array();
				triple.push(user.uid);
				triple.push(Number(uid_of_friend_of_user));
				triple.push(mutual_friends[i]);
				triple.sort(function(uid_1,uid_2) { return uid_1 - uid_2;});				

				var group = new Object({uids: triple,used_in_merged:false});
				if (index_of_same_group(groups_3,group)==-1) {
					groups_3.push(group);
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

function get_intersected_array(array_1,array_2) {
	
	var array_1_as_object = {};
	for (var element_index = 0; element_index < array_1.length;element_index++) {
		array_1_as_object[array_1[element_index]] = true;
	}
	
	var result = [];
	
	for (var element_index=0;element_index<array_2.length;element_index++) {
		var element = array_2[element_index];
		if (array_1_as_object[element]) {
			result.push(element);
		}
	}
	return result;
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
	if (user.mutual_friends) {
		var groups_3 = find_triples(user);
		var groups = merge_groups(user, 4,11,groups_3);
		
		var uids = get_distinct_uids(groups);
		var profiles_left_to_load = 0;
		for (var uid in user.friends){
			if (!loaded_contacts[uid]) {
				loaded_contacts[uid] = {uid:uid};
			}
			var contact = loaded_contacts[uid];
			if (!contact.first_name) {
				profiles_left_to_load++;
				vk_loader.load( getProfiles_traits, {contact:contact,fields:"uid,first_name,photo"}, function(parameters,result_message){
					profiles_left_to_load--;
					if (profiles_left_to_load == 0) {
						draw_grid_of_friends(user);
					}
				});
			}
					
		}
	}
}

function delete_value_in_grid(grid,index) {
	if (grid[index[0]]) {
		delete grid[index[0]][index[1]];
		var count_of_indexes;
		for (var indexes in grid[index[0]]) {
			count_of_indexes++;
		}
		if (count_of_indexes == 0) {
			delete grid[index[0]];
		}
	}
}

function get_index_in_grid(grid,value) {
//may be optimized	
	var index = undefined;
	for_each_index_in_grid(grid,function(current_index) {		
		if (get_value_in_grid(grid,current_index) == value) {

			index = current_index;
		}
	});
	return index;
}

function get_value_in_grid(grid, index) {
	if (grid[index[0]]) {
		return grid[index[0]][index[1]];		
	}
	else {
		return undefined;
	}
}

function set_value_in_grid(grid,index,value) {
	if (!grid[index[0]]) {
		grid[index[0]] = [];
	}
	grid[index[0]][index[1]] = value;	
}

function for_each_index_in_grid(grid,callback) {
	for (var grid_index_x in grid) {
		for (var grid_index_y in grid[grid_index_x]) {
			callback([Number(grid_index_x),Number(grid_index_y)]);
		}
	}
}

function find_index_for_uid(grid, friend_uid,indexes_of_placed_contacts) {
	if (indexes_of_placed_contacts.length != 0) {
		var middle_coordinate = get_middle_coordinate(indexes_of_placed_contacts);
		return get_nearest_free_index(grid,middle_coordinate);
	} 
	else {
		return get_index_in_free_area(grid, 2);	
	}
}

function add_mutual_friends_recursively(user,uid,list,excludes) {
	var mutual_friends = user.mutual_friends[uid];
	if (mutual_friends) {
		for (var i = 0; i < mutual_friends.length; i++) {
			var mutual_friend_uid = mutual_friends[i];
			if (!excludes[mutual_friend_uid]) {
				list.push(mutual_friend_uid);
				excludes[mutual_friend_uid] = true;
				add_mutual_friends_recursively(user,mutual_friend_uid,list,excludes);
			}
		}
	}
}

function create_grid_of_friends(user,group) {
	var grid = {};
	for (var i = 0; i < group.length; i++) {
		var friend_uid = group[i];
		var indexes_of_placed_contacts = [];
		var mutual_friends = user.mutual_friends[friend_uid];
		if (mutual_friends) {
			for (var j = 0; j < mutual_friends.length; j++) {
				var uid_of_mutual_friend = mutual_friends[j];
				var index_of_mutual_friend = get_index_in_grid(grid,uid_of_mutual_friend);

				if (index_of_mutual_friend) {
					indexes_of_placed_contacts.push(index_of_mutual_friend);
				}						
			}			
		}
		var index_of_friend = find_index_for_uid(grid,friend_uid,indexes_of_placed_contacts);
		set_value_in_grid(grid,index_of_friend, friend_uid);		
	}
	return grid;
}

function get_shifted_grid(grid,lower_bound) {

	var shifted_grid = {};
	var bounds = find_bounding_indexes(grid);
	var horizontal_shift = lower_bound[0] - bounds[0][0];
	var vertical_shift = lower_bound[1] - bounds[0][1];
	
	for_each_index_in_grid(grid, function(grid_index) {
		var shifted_index = [grid_index[0] + horizontal_shift
                             ,grid_index[1] + vertical_shift];
		var value = get_value_in_grid(grid,grid_index);
		set_value_in_grid(shifted_grid,shifted_index,value);
	});
	return shifted_grid;
}


function point_is_in_bounds(point, bounds) {
	return point[0] > bounds[0][0] && point[0] < bounds[1][0] 
			&& point[1] > bounds[0][1] && point[1] < bounds[1][1];
}

function point_is_in_area(point, area) {
	for (var i=0; i < area.length; i++) {
		if (point_is_in_bounds(point, area[i])) {
			return true;
		}
	}
	return false;
}

function get_bounds_of_area(area) {
	var area_bounds = [[0,0],[0,0]];
	for (var i = 0; i < area.length; i++) {
		var bounds = area[i];

		if (bounds[0][0] < area_bounds[0][0]) {
			area_bounds[0][0] = bounds[0][0];
		}
		if (bounds[0][1] < area_bounds[0][1]) {
			area_bounds[0][1] = bounds[0][1];
		}
		if (bounds[1][0] > area_bounds[1][0]) {
			area_bounds[1][0] = bounds[1][0];
		}
		if (bounds[1][1] > area_bounds[1][1]) {
			area_bounds[1][1] = bounds[1][1];
		}
	}
	return area_bounds;
}

function get_lower_bound_for_grid(grids_positions,dimensions_of_grid,maximum_width,delta) {
/*	
	if (grids_positions.length == 0) {
		return [delta,delta];
	}
*/	
	for (var i = 0; i < grids_positions.length; i++) {
		var lower_bound = [grids_positions[i][1][0] + delta, grids_positions[i][0][1]];
		var middle_point = [lower_bound[0] + dimensions_of_grid[0]/2, lower_bound[1] + dimensions_of_grid[1]/2];
		var upper_bound = [lower_bound[0] + dimensions_of_grid[0], lower_bound[1] + dimensions_of_grid[1]];
		if (upper_bound[0] + 1.0 <= maximum_width) {
			if (!point_is_in_area(lower_bound, grids_positions)
					&& !point_is_in_area(middle_point, grids_positions)
					&& !point_is_in_area(upper_bound, grids_positions)) {
				return lower_bound;
			}
		}
	}

	for (var i = 0; i < grids_positions.length; i++) {
		var lower_bound = [grids_positions[i][0][0], grids_positions[i][1][1] + delta];
		var middle_point = [lower_bound[0] + dimensions_of_grid[0]/2, lower_bound[1] + dimensions_of_grid[1]/2];
		var upper_bound = [lower_bound[0] + dimensions_of_grid[0], lower_bound[1] + dimensions_of_grid[1]];
		if (upper_bound[0] + 1.0 <= maximum_width) {
			if (!point_is_in_area(lower_bound, grids_positions)
					&& !point_is_in_area(middle_point, grids_positions)
					&& !point_is_in_area(upper_bound, grids_positions)) {
				return lower_bound;
			}
		}
	}
	
	for (var i = 0; i < grids_positions.length; i++) {
		var lower_bound = [grids_positions[i][1][0] + delta, grids_positions[i][1][1] + delta];
		var middle_point = [lower_bound[0] + dimensions_of_grid[0]/2, lower_bound[1] + dimensions_of_grid[1]/2];
		var upper_bound = [lower_bound[0] + dimensions_of_grid[0], lower_bound[1] + dimensions_of_grid[1]];
		if (upper_bound[0] + 1.0 <= maximum_width) {
			if (!point_is_in_area(lower_bound, grids_positions)
					&& !point_is_in_area(middle_point, grids_positions)
					&& !point_is_in_area(upper_bound, grids_positions)) {
				return lower_bound;
			}
		}
	}

	
	return [get_bounds_of_area(grids_positions)[1][0] + delta
	        ,get_bounds_of_area(grids_positions)[1][1] + delta];
	
/*	
	if (filled_segment[1][0] + dimensions_of_grid[0] < maximum_width) {
		return [filled_segment[1][0]+delta,filled_segment[0][1]];
	} else {
		return [filled_segment[0][0],filled_segment[1][1]+delta];
	}
*/	
}

function draw_grid_of_friends(user) {

	var grids = [];
	var excludes = {};
	for (var uid_string in user.friends) {
		var uid = Number(uid_string);
		if (!excludes[uid]) {
			excludes[uid] = true;
			var group = [uid];
			add_mutual_friends_recursively(user,uid,group,excludes);
			group.sort(function(friend_1,friend_2) {
				var counter_1 = user.mutual_friends[friend_1] ? user.mutual_friends[friend_1].length : 0;
				var counter_2 = user.mutual_friends[friend_2] ? user.mutual_friends[friend_2].length : 0;
				var delta_between_counters = counter_2 - counter_1;
				return delta_between_counters != 0 ? delta_between_counters : friend_2 - friend_1;
			});
			grids.push(get_shifted_grid(create_grid_of_friends(user,group),[0,0]));
		}
	}
//	var filled_segment = [[0,0],[0,0]];
//	var empty_subsegment = [[0,0],[0,0]];
	var width_of_window = 606;

	var paper = Raphael("canvas", width_of_window, 900);
	var width_of_cell = 50;
	var width_of_border = 5;
	
	var grids_positions = [];
	
	
	for (var i = 0; i < grids.length; i++) {
		var grid = grids[i];
		var bounds = get_bounds_of_grid(grid);
		var dimensions_of_grid = [bounds[1][0] - bounds[0][0]
		,bounds[1][1] - bounds[0][1]];
		var lower_bound_for_grid = get_lower_bound_for_grid(grids_positions
							,dimensions_of_grid,width_of_window/(width_of_cell),0.1);
		var upper_bound_for_grid = [lower_bound_for_grid[0] + dimensions_of_grid[0]
									,lower_bound_for_grid[1]+ dimensions_of_grid[1]];
		grids_positions.push([lower_bound_for_grid, upper_bound_for_grid]);

		for_each_index_in_grid(grid, function(grid_index) {
			var uid = get_value_in_grid(grid,grid_index);
			var coordinate = get_coordinate(grid_index);
			
			var shifted_coordinate = [coordinate[0] -bounds[0][0] + lower_bound_for_grid[0]
										,coordinate[1] -bounds[0][1] + lower_bound_for_grid[1]];
			
			var expand_edge = [];
//			[1,-1],[0,-1],[-1,0],[-1,1],[0,1],[1,0]
			
			var shifts_counter_clockwise = [[-1,0],[0,1],[1,1],[1,0],[0,-1],[-1,-1]];
			
			for (var shift_index = 0; shift_index < shifts_counter_clockwise.length; shift_index++) {
				var index_x = grid_index[0] + shifts_counter_clockwise[shift_index][0];
				var index_y = grid_index[1] + shifts_counter_clockwise[shift_index][1];
				expand_edge.push(get_value_in_grid(grid, [ index_x, index_y]) == undefined);							
			}
/*
			for (var neighbor_index_y = grid_index[1] + 1; neighbor_index_y >= grid_index[1] - 1; neighbor_index_y--) {				
				var second_index_x = neighbor_index_y == grid_index[1] ? grid_index[0] + 1 : grid_index[0];   
				expand_edge.push(get_value_in_grid(grid, [second_index_x, neighbor_index_y]) == undefined);
				expand_edge.push(get_value_in_grid(grid, [grid_index[0] - 1, neighbor_index_y]) == undefined);
			}
*/
			draw_contact_icon(paper,uid,shifted_coordinate, width_of_cell,width_of_border, expand_edge);
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

	
	var result_string = getUrlParameter(window.location.href, "api_result");
	var result = JSON.parse(unescape(result_string));
	if (!result.response) {
		if (result.error) {
			alert(result.error.error_msg);
			return;
		}
	}
	userContact.friends = {};
	for (var uid_index=0;uid_index<result.response.length;uid_index++) {
		userContact.friends[result.response[uid_index]]=true;
	}

//	load_friends_of_contact_recursive(userContact, 0,function(contact) {
		
		var friends_left_to_process = 0;
		for (var uid in userContact.friends) {
			friends_left_to_process++;
			var friend = {uid:Number(uid)};
			vk_loader.load(friends_getMutual_traits,{contact_1:userContact,contact_2:friend},function(parameters,result_message) {
				if (result_message == "Success" 
					&& parameters.contact_2.mutual_friends 
					&& parameters.contact_2.mutual_friends[parameters.contact_1.uid]){
					loaded_contacts[parameters.contact_2.uid] = parameters.contact_2;
				}
				friends_left_to_process--;
				if (friends_left_to_process == 0) {
					process_output(userContact);									

					
				}				
			});
		}
//	});
	

}, 0);

		
		
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
	
	function merge_segments_with_same_uid_at_tip(segments,graph) {
		for (var segment_index_1 = 0; segment_index_1 < segments.length;segment_index_1++) {
			var segment_1 = segments[segment_index_1];

//algorithm may be improved by different handling of segments with same uids on tips
			if (segment_1[0] == segment_1[segment_1.length - 1]) {
				segment_1.pop();
				return {segments_are_changed:true,graph:graph};
			}
			for (var segment_index_2 = 0; segment_index_2 < segments.length;segment_index_2++) {
				if (segment_index_2 != segment_index_1) {
					var segment_2 = segments[segment_index_2];
					if (segment_1[segment_1.length - 1] == segment_2[0]
						|| segment_1[segment_1.length - 1] == segment_2[segment_2.length - 1]) {
						segment_1.reverse();
					}
					if (segment_2[0] == segment_1[0]) {
						segment_2.reverse();
					}
					if (segment_1[0] == segment_2[segment_2.length - 1]) {
						segment_2.pop();
						var new_graph = clone_graph_without_node(graph,segment_1[0]);
						segments[segment_index_1] = segment_2.concat(segment_1);
						segments.splice(segment_index_2,1);
						return {segments_are_changed:true,graph:new_graph};
					}
				}
			}
		}
		return {segments_are_changed:false,graph:graph};
	}
	
	function find_path_with_minimum_new_connections(edges_counter,uids) {
		var graph = form_graph_of_uids_connections(edges_counter,uids);
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
				graph[id_2].connections.splice(index_of(graph[id_2].connections,id_1),1);
				segments.push([id_1,id_2]);
				do {
					 
					var result = merge_segments_with_same_uid_at_tip(segments,graph);
					var graph = result.graph;
				} while (result.segments_are_changed);
			} else {
				graph = clone_graph_without_node(graph, id_1);
			}
		}

//algorithm may be improved by different merging of segments		
		var result = [];
		for (var segment_index = 0;segment_index < segments.length;segment_index++) {
			result = result.concat(segments[segment_index]);
		}
		return result;
	}
	
	function form_graph_of_uids_connections(edges_counter,uids) {
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
		return existing_segments;
	}
	
	
	
	function find_path(groups,edges_counter,uids) {
		var path = find_path_with_minimum_new_connections(edges_counter,uids);
		
//algorithm may be improved by checking groups in various order		
		for (var group_index = 0; group_index <groups.length;group_index++) {
			var group = groups[group_index];
			var elements_not_in_path = get_substracted_array(uids,path);
			var addition_to_path = get_intersected_array(elements_not_in_path,group.uids);
			path = path.concat(addition_to_path);
		}
		return path;
		
	}

	
	function find_bounding_indexes(grid) {
		var lower_bound = [Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY]; 
		var upper_bound = [Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY];
		for_each_index_in_grid(grid,function(grid_index) {
			if (lower_bound[0] > grid_index[0]) {
				lower_bound[0] = grid_index[0];
			}
			if (lower_bound[1] > grid_index[1]) {
				lower_bound[1] = grid_index[1];
			}
			if (upper_bound[0] < grid_index[0]) {
				upper_bound[0] = grid_index[0];
			}
			if (upper_bound[1] < grid_index[1]) {
				upper_bound[1] = grid_index[1];
			}			
		});
		return [lower_bound,upper_bound];
	}
	
	function get_index_in_free_area(grid,range) {
		var bounds = find_bounding_indexes(grid);
		var lower_bound = bounds[0];
		var upper_bound = bounds[1];
		var bounds_size = [upper_bound[0] - lower_bound[0], upper_bound[1] - lower_bound[1]];
		if (bounds_size[0] < 0
			&& bounds_size[1] < 0) {
			return [0,0];
		}
		if (bounds_size[0] < bounds_size[1]) {
			return [Math.round(upper_bound[0] + range), Math.round(lower_bound[1] + bounds_size[1]/2)];
		} 
		else {
			return [Math.round(lower_bound[0] + bounds_size[0]/2),Math.round(upper_bound[1] + range)];
		}
	}
	
	function get_distance(coordinate_1,coordinate_2) {
		var delta = [coordinate_2[0]-coordinate_1[0]
					,coordinate_2[1]-coordinate_1[1]];		
		return Math.sqrt(delta[0]*delta[0] + delta[1]*delta[1]);
	}
	
	function get_nearest_free_index(grid,coordinate) {
		
		var index = get_index(coordinate);
		if (!get_value_in_grid(grid,index)) {
			return index;
		}
		var r = 1;
		var nearest_found_free_index = undefined;
		var current_index = index;
		while (true) {
			current_index = [current_index[0],current_index[1] + 1];
			var nearest_found_index_in_cycle = current_index;

			var shifts = [[1,-1],[0,-1],[-1,0],[-1,1],[0,1],[1,0]];
			for (var shift_index = 0; shift_index < shifts.length;shift_index++) {
				var shift = shifts[shift_index];
				for (var counter = 0; counter < r; counter++) {
					var distance_to_current_index = get_distance(coordinate
							,get_coordinate(current_index));
					var distance_to_nearest_found_index_in_cycle = get_distance(coordinate
														,get_coordinate(nearest_found_index_in_cycle));
					if (distance_to_current_index < distance_to_nearest_found_index_in_cycle) {
						nearest_found_index_in_cycle = current_index;
					}
					if (!get_value_in_grid(grid,current_index)) {
						if (nearest_found_free_index) {
							var distance_to_nearest_found_free_index = get_distance(coordinate
															,get_coordinate(nearest_found_free_index));
							
							if (distance_to_current_index < distance_to_nearest_found_free_index) {
								nearest_found_free_index = current_index;
							}
						}
						else {
							nearest_found_free_index = current_index;
						}
					}
					current_index = [current_index[0] + shift[0],current_index[1] + shift[1]];
				}
			}
			if (nearest_found_free_index) {
				var distance_to_nearest_found_free_index = get_distance(coordinate
															,get_coordinate(nearest_found_free_index));
				var distance_to_nearest_found_index_in_cycle = get_distance(coordinate
														,get_coordinate(nearest_found_index_in_cycle));
				if (distance_to_nearest_found_free_index <= distance_to_nearest_found_index_in_cycle) {
					return nearest_found_free_index;
				}
			}
			r++;
			
		}
	}
	
	function get_middle_coordinate(indexes) {
		var accumulator = [0,0];
		for (var index_of_index = 0; index_of_index < indexes.length; index_of_index++) {
			var index = indexes[index_of_index];
			var coordinate = get_coordinate(index);
			accumulator[0]+=coordinate[0];
			accumulator[1]+=coordinate[1];			
		}
		
		var middle_coordinate = [accumulator[0]/indexes.length
		                    ,accumulator[1]/indexes.length];
		
		return middle_coordinate;
	}
	
	function get_coordinate(index) {
		var k1 = Math.sqrt(3)/2;
		var k2 = Math.sqrt(3) - 3/2;
		
		var x_offset = (-index[1]*k2 + index[0]*k1);
		var y_offset = (index[1]*k1 - index[0]*k2);
		
		return [x_offset,y_offset];
	}

	function get_index(coordinate) {
		var divisor = 3*Math.sqrt(3) - 18/4;
		
		var k1 = Math.sqrt(3)/2;
		var k2 = Math.sqrt(3) - 3/2;
		
		
		return [Math.round((k1*coordinate[0] + k2*coordinate[1])/divisor)
				,Math.round((k1*coordinate[1] + k2*coordinate[0])/divisor)];
	}

	
	function scale_vector(vector, new_length) {
		var arg = new_length/Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1]);
		var sx = vector[0]*arg;
		var sy = vector[1]*arg;
		return [sx, sy];		
	}

	function calculate_vector(angle, length) {
		return [Math.cos(angle)*length,Math.sin(angle)*length];
	}
	
	
	function calculate_radius(angle, delta) {
		var length = Math.sqrt(delta[0]*delta[0] + delta[1]*delta[1]);
		switch (angle)
		{
		case 120:
			return length;
		case 150:
			return length/Math.sqrt(2 - Math.sqrt(3));
		default:
			throw "not supported angle";
		}		
	}
	
	function create_path_of_object(start_point, points, invert_axis_of_object, expand_edge, width_of_cell) {
		var path = "M " + start_point[0] + " " + start_point[1];
		var angle = 0;
		for (var point_index = 0; point_index < points.length; point_index++) {
			var previous_index = (points.length+point_index - 1)%points.length;
			var next_index = (point_index + 1)%points.length;
			var previous_delta = points[previous_index];			
			var delta = points[point_index];
			
			var distance_from_corner = 0;
			var previous_scaled_delta = scale_vector(previous_delta, distance_from_corner);
			var scaled_delta = scale_vector(delta, distance_from_corner);
			var index_of_x_axis = invert_axis_of_object ? 1 : 0;
			var index_of_y_axis = invert_axis_of_object ? 0 : 1;
			
			
// handling of lower left corner			
			if (expand_edge[0] && expand_edge[1] && point_index == 1) {
				var line_width = previous_delta[0] + delta[0];
				var line_height = previous_delta[1] + delta[1];
				path += " l " + 0 + " "
				  + line_height;				
				path += " l " + line_width + " "
				  + 0;													
			}
			if (expand_edge[0] && expand_edge[1] && (point_index == 0 || point_index == 1)) {
				continue;
			}

			//handling of upper right corner			
			if (expand_edge[3] && expand_edge[4] && point_index == 4) {
				var line_width = previous_delta[0] + delta[0];
				var line_height = previous_delta[1] + delta[1];
				path += " l " + 0 + " "
				  + line_height;				
				path += " l " + line_width + " "
				  + 0;													
			}
			if (expand_edge[3] && expand_edge[4] && (point_index == 3 || point_index == 4)) {
				continue;
			}
			
			
			if (!expand_edge[previous_index] || !expand_edge[point_index]) {
				var ellipse_destination = [0, 0];
				if (!expand_edge[previous_index]) {
					ellipse_destination[0] += previous_scaled_delta[index_of_x_axis];
					ellipse_destination[1] += previous_scaled_delta[index_of_y_axis];
				}
				if (!expand_edge[point_index]) {
					ellipse_destination[0] += scaled_delta[index_of_x_axis];
					ellipse_destination[1] += scaled_delta[index_of_y_axis];
				}
				var radius = calculate_radius(delta[2], ellipse_destination); 
				
				var angle = 0;

				path += " a " + radius + "," + radius
				+ " " + angle + " 0," + (invert_axis_of_object ? 0 : 1) + " "
					+ ellipse_destination[0] + "," + ellipse_destination[1];								
			}
			

			

			if (expand_edge[point_index]) {
				var line_width = delta[index_of_x_axis];
				var line_height = delta[index_of_y_axis];
				if (point_index == 2 || point_index ==5) {
					path += " l " + line_width + " "
					  + 0;				
					path += " l " + 0 + " "
					  + line_height;				
				}
				else {
					path += " l " + 0 + " "
					  + line_height;				
					path += " l " + line_width + " "
					  + 0;									
				}
			} else {							
				var line_width = delta[index_of_x_axis] - 2*scaled_delta[index_of_x_axis];
				var line_height = delta[index_of_y_axis] - 2*scaled_delta[index_of_y_axis]; 
				path += " l " + line_width + " "
				  + line_height;				
			}

		}
		return path + " z";
		
	}
	
	function calculate_deltas_of_hexagon(length_of_side,angle_of_rotation) {
		var deltas = [];
		for (var side_index = 0;side_index <6; side_index++) {
			var angle = ( angle_of_rotation + side_index*Math.PI/3 );
			var delta = calculate_vector(angle,length_of_side);
			delta.push(120);
			deltas.push(delta);
		}
		return deltas;
	}
	
	
	function get_bounds_of_grid(grid) {
		
		var bounds = [[Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY]
						,[Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY]];
		
		var offset = 1/2;
		
		for_each_index_in_grid(grid, function(index) {
			var coordinate = get_coordinate(index);
			var lower_bound = [coordinate[0]-offset,coordinate[1]-offset];
			var upper_bound = [coordinate[0]+offset,coordinate[1]+offset];
			if (lower_bound[0] < bounds[0][0]) {
				bounds[0][0] = lower_bound[0];
			}
			if (lower_bound[1] < bounds[0][1]) {
				bounds[0][1] = lower_bound[1];
			}
			if (upper_bound[0] > bounds[1][0]) {
				bounds[1][0] = upper_bound[0];
			}
			if (upper_bound[1] > bounds[1][1]) {
				bounds[1][1] = upper_bound[1];
			}			
		});
		return bounds;
	}
	
	function create_contact_icon(paper,contact,width_of_cell,offset, expand_edge) {
		if (contact && contact.photo) {
			
			var sqrt3 = Math.sqrt(3);

			
			var deltas = calculate_deltas_of_hexagon(width_of_cell/Math.sqrt(2 + Math.sqrt(3)),Math.PI/12);
			

			
			var path_string = create_path_of_object([offset.x + deltas[3][0]
													,offset.y + deltas[3][1]], deltas, true, expand_edge, width_of_cell);
			var image = paper.path(path_string);
			
			
			
//			var image = r.rect(node.point[0], node.point[1], 50, 50, 5);
			image.attr({
			    fill: "url(" + contact.photo + ")",
			    "stroke-width": 0,
			    "stroke-opacity":"0",
			    "cursor" : "pointer"
			});
//			image.attr({"href":get_contact_url(uid),"target":"_top"});

			
//            set.push(r.text(node.point[0] + 15, node.point[1] + 41, contact.first_name).attr({"text-anchor":"middle"}));
//            set.push(r.text(node.point[0] + 15, node.point[1] + 51, contact.last_name).attr({"text-anchor":"middle"}));
			return image;
		}
		else {
			var color = Raphael.getColor();
			return paper.ellipse(offset.x, offset.y, 20, 15)
				.attr({fill: color, stroke: color, "stroke-width": 2,"cursor" : "pointer"});
		}
		
	}
	
	function draw_contact_icon(paper,uid,coordinate,width_of_cell,width_of_border, expand_edge) {
		var x_offset = (width_of_cell + width_of_border)*coordinate[0];
		var y_offset = (width_of_cell + width_of_border)*coordinate[1];
		
		var contact = loaded_contacts[uid];

		var icon = create_contact_icon(paper,contact,width_of_cell,{x:x_offset,y:y_offset}, expand_edge);
		

		icon.node.onclick = function() {
			try {
				parent.window.location = get_contact_url(uid);
			} catch (exception) {
//				ie workaround					
				window.open(get_contact_url(uid));
			}
		};
	
	
	}
		
	

