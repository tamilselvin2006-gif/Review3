let me = null, allTickets = [], staffList = [], modal;

function alertUser(message, error = false) {
  const box = $("<div>").addClass("app-alert").toggleClass("error", error).text(message);
  $("#alerts").append(box);
  setTimeout(() => box.fadeOut(250, () => box.remove()), 3500);
}
async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}
function switchAuth(register) {
  $("#alerts").empty();
  $("#loginPanel").toggleClass("d-none", register);
  $("#registerPanel").toggleClass("d-none", !register);
  $("#authHeading").text(register ? "Create your account" : "Welcome to CampusCare");
  $("#authSubheading").text(register ? "Register as a student to submit maintenance requests." : "Sign in to manage campus maintenance requests.");
}
function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function enterDashboard(user) {
  me = user;
  $("#authPage").addClass("d-none");
  $("#dashboardPage").removeClass("d-none");
  $("#currentName").text(user.name);
  $("#currentRole").text(user.role);
  $("#dashboardHeading").text(user.role === "admin" ? "Admin Dashboard" : user.role === "staff" ? "Staff Dashboard" : "Student Dashboard");
  $("#dashboardDescription").text(user.role === "admin" ? "Manage requests, assign staff and view reports." : user.role === "staff" ? "View assigned work and update request progress." : "Submit a maintenance issue and follow its progress.");
  $("#createTicketButton").toggle(user.role !== "staff");
  $("#statsRow").toggleClass("d-none", user.role !== "admin");
  $("#reportCard").toggleClass("d-none", user.role !== "admin");
  $("#listDescription").text(user.role === "student" ? "Requests submitted by you." : user.role === "staff" ? "Requests assigned to you." : "All maintenance requests.");
  refreshDashboard();
}
async function refreshDashboard() {
  try {
    allTickets = await request("/api/tickets");
    drawTickets(allTickets);
    if (me.role === "admin") {
      const report = await request("/api/reports");
      $("#totalCount").text(report.total);
      $("#pendingCount").text(report.pending);
      $("#progressCount").text(report.inProgress);
      $("#resolvedCount").text(report.resolved);
      $("#categoryRows").empty();
      if (!report.categories.length) $("#categoryRows").html('<p class="text-secondary mb-0">No requests available yet.</p>');
      report.categories.forEach(x => $("#categoryRows").append(`<div class="report-line"><span>${escapeText(x._id)}</span><b>${x.count}</b></div>`));
      staffList = await request("/api/staff");
    }
  } catch (e) { alertUser(e.message, true); }
}
function drawTickets(list) {
  const rows = $("#ticketRows").empty();
  if (!list.length) {
    rows.html('<tr><td colspan="7" class="text-center text-secondary py-5">No requests found. Create a request to get started.</td></tr>');
    return;
  }
  list.forEach(t => {
    const status = t.status.toLowerCase().replace(" ", "-");
    const priority = t.priority.toLowerCase();
    let buttons = `<button class="action-btn edit-btn" data-id="${t._id}">View / Edit</button>`;
    if (me.role === "admin" || (me.role === "student" && t.status === "Pending")) buttons += `<button class="action-btn delete-btn" data-id="${t._id}">Delete</button>`;
    rows.append(`<tr>
      <td><div class="ticket-name">${escapeText(t.title)}</div><div class="subtext">${escapeText(t.createdBy?.name || "Student")} · ${new Date(t.createdAt).toLocaleDateString()}</div></td>
      <td>${escapeText(t.category)}</td>
      <td><span class="pill priority-${priority}">${escapeText(t.priority)}</span></td>
      <td><span class="pill status-${status}">${escapeText(t.status)}</span></td>
      <td>${escapeText(t.location)}</td>
      <td>${escapeText(t.assignedTo?.name || "Not assigned")}</td>
      <td class="text-nowrap">${buttons}</td></tr>`);
  });
}
function clearTicketForm() {
  $("#ticketForm")[0].reset(); $("#ticketId").val(""); $("#ticketPriority").val("Medium");
  $("#ticketAssigned").html('<option value="">Not assigned</option>');
  $("#ticketTitle,#ticketDescription,#ticketCategory,#ticketPriority,#ticketLocation").prop("disabled", false);
  $("#saveTicket").show();
}
function createTicket() {
  clearTicketForm();
  $("#ticketModalTitle").text("Create Maintenance Request");
  $(".admin-field,.staff-field").addClass("d-none");
  modal.show();
}
async function editTicket(id) {
  const t = allTickets.find(x => x._id === id);
  if (!t) return;
  clearTicketForm();
  $("#ticketId").val(id); $("#ticketTitle").val(t.title); $("#ticketDescription").val(t.description);
  $("#ticketCategory").val(t.category); $("#ticketPriority").val(t.priority); $("#ticketLocation").val(t.location);
  $("#ticketModalTitle").text("Maintenance Request Details");
  if (me.role === "admin") {
    $(".admin-field").removeClass("d-none");
    $("#ticketStatus").val(t.status); $("#adminNote").val(t.adminNote || "");
    staffList.forEach(s => $("#ticketAssigned").append(`<option value="${s._id}">${escapeText(s.name)}</option>`));
    $("#ticketAssigned").val(t.assignedTo?._id || "");
  } else if (me.role === "staff") {
    $(".staff-field").removeClass("d-none");
    $("#ticketTitle,#ticketDescription,#ticketCategory,#ticketPriority,#ticketLocation").prop("disabled", true);
    $("#staffStatus").val(t.status === "Resolved" ? "Resolved" : "In Progress");
  } else if (t.status !== "Pending") {
    $("#ticketTitle,#ticketDescription,#ticketCategory,#ticketPriority,#ticketLocation").prop("disabled", true);
    $("#saveTicket").hide();
  }
  modal.show();
}

$("#showRegister").on("click", e => { e.preventDefault(); switchAuth(true); });
$("#showLogin").on("click", e => { e.preventDefault(); switchAuth(false); });

$("#loginForm").on("submit", async function(e) {
  e.preventDefault();
  $("#loginButton").prop("disabled", true).text("Checking...");
  try {
    const result = await request("/api/login", { method: "POST", body: JSON.stringify({ email: $("#loginEmail").val().trim(), password: $("#loginPassword").val() }) });
    alertUser("Login successful. Welcome " + result.user.name);
    enterDashboard(result.user);
  } catch (err) { alertUser(err.message, true); }
  finally { $("#loginButton").prop("disabled", false).text("Login"); }
});
$("#registerForm").on("submit", async function(e) {
  e.preventDefault();
  $("#registerButton").prop("disabled", true).text("Creating account...");
  try {
    const result = await request("/api/register", { method: "POST", body: JSON.stringify({
      name: $("#registerName").val().trim(), email: $("#registerEmail").val().trim(), password: $("#registerPassword").val()
    }) });
    alertUser(result.message);
    $("#loginEmail").val($("#registerEmail").val().trim());
    $("#loginPassword").val("");
    $("#registerForm")[0].reset();
    switchAuth(false);
  } catch (err) { alertUser(err.message, true); }
  finally { $("#registerButton").prop("disabled", false).text("Create Student Account"); }
});
$("#logoutButton").on("click", async function() {
  try {
    await request("/api/logout", { method: "POST", body: "{}" });
    me = null; allTickets = [];
    $("#dashboardPage").addClass("d-none"); $("#authPage").removeClass("d-none");
    $("#loginPassword").val(""); switchAuth(false);
    alertUser("You have logged out successfully.");
  } catch (err) { alertUser(err.message, true); }
});
$("#createTicketButton").on("click", createTicket);
$("#ticketRows").on("click", ".edit-btn", function() { editTicket($(this).data("id")); });
$("#ticketRows").on("click", ".delete-btn", async function() {
  const id = $(this).data("id");
  if (!confirm("Are you sure you want to delete this request?")) return;
  try { const result = await request("/api/tickets/" + id, { method: "DELETE" }); alertUser(result.message); refreshDashboard(); }
  catch (err) { alertUser(err.message, true); }
});
$("#ticketForm").on("submit", async function(e) {
  e.preventDefault();
  const id = $("#ticketId").val(), payload = {};
  if (me.role === "staff") payload.status = $("#staffStatus").val();
  else {
    payload.title = $("#ticketTitle").val().trim();
    payload.description = $("#ticketDescription").val().trim();
    payload.category = $("#ticketCategory").val();
    payload.priority = $("#ticketPriority").val();
    payload.location = $("#ticketLocation").val().trim();
    if (me.role === "admin") {
      payload.status = $("#ticketStatus").val();
      payload.assignedTo = $("#ticketAssigned").val();
      payload.adminNote = $("#adminNote").val();
    }
  }
  try {
    const result = id
      ? await request("/api/tickets/" + id, { method: "PUT", body: JSON.stringify(payload) })
      : await request("/api/tickets", { method: "POST", body: JSON.stringify(payload) });
    modal.hide(); alertUser(result.message); refreshDashboard();
  } catch (err) { alertUser(err.message, true); }
});
$("#searchBox").on("input", function() {
  const q = $(this).val().toLowerCase();
  drawTickets(allTickets.filter(t => [t.title,t.category,t.priority,t.status,t.location,t.createdBy?.name,t.assignedTo?.name].some(v => String(v || "").toLowerCase().includes(q))));
});

$(async function() {
  modal = new bootstrap.Modal(document.getElementById("ticketModal"));
  try { const result = await request("/api/me"); enterDashboard(result.user); }
  catch (_) { switchAuth(false); }
});
