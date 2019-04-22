const express	= require('express');
const cookparse	= require('cookie-parser');
const mysql 	= require('mysql');
const path		= require('path');
const fetch		= require('node-fetch');

require('dotenv').config();

const db	= mysql.createConnection({
										host:process.env.DB_HOST,
										user: process.env.DB_USER,
										password: process.env.DB_PASS,
										database: process.env.DB_NAME
									});

const app = express();

app.set("view-engine","ejs");
app.set("views","./pages");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookparse());

app.use(express.static(__dirname + '/public'));

const genCode = function(table,num) {
	var codestring="";
	var codenum=0;
	while (codenum<(num==undefined ? 4 : num)){
		codestring=codestring+table[Math.floor(Math.random() * (table.length))];
		codenum=codenum+1;
	}
	return codestring;
}

async function setup() {
	db.query(`CREATE TABLE IF NOT EXISTS links(
		id		VARCHAR(8) PRIMARY KEY,
		link 	TEXT NOT NULL,
		name 	TEXT
	)`)
}

async function isValidUser(user, pass) {
	return new Promise((res,rej)=>{
		db.query(`SELECT * FROM users WHERE name=? AND password=?`,[user,pass],(err,rows)=>{
			if(err) {
				console.log(err);
				res(false);
			}
			if(rows[0]) {
				res(true);
			} else {
				res(false);
			}
		})
	})
}

async function getLink(link) {
	return new Promise((res,rej)=>{
		db.query(`SELECT * FROM links WHERE link=?`,[link],(err,rows)=>{
			if(err) {
				console.log(err);
				res(undefined);
			}
			if(rows[0]) {
				res(rows[0]);
			} else {
				res(undefined);
			}
		})
	})
}

async function getLinkID(id) {
	return new Promise((res,rej)=>{
		db.query(`SELECT * FROM links WHERE id=?`,[id],(err,rows)=>{
			if(err) {
				console.log(err);
				res(undefined);
			}
			if(rows[0]) {
				res(rows[0]);
			} else {
				res(undefined);
			}
		})
	})
}

function getLinks() {
	return new Promise((res)=>{
		db.query(`SELECT * FROM links`,(err,rows)=>{
			if(err) {
				console.log(err);
				res("ERR")
			} else {
				res(rows);
			}
		})
	})
}

app.get("/",async (req,res)=>{
	var logged;
	var links = [];
	if(req.cookies.user) {
		var user = JSON.parse(req.cookies.user);
		logged = await isValidUser(user.name, user.pass);
		if(logged) {
			links = await getLinks();
		}
	} else {
		logged = false;
	}
	res.render("index.ejs",{logged_in: logged, links: links});
})

app.get("/:id",async (req,res)=>{
	var link = await getLinkID(req.params.id);
	if(link) {
		res.redirect(link.link);
	} else {
		res.send("ERR: NOT FOUND");
	}
})

app.post("/link",async (req,res)=>{
	var user;
	if(req.cookies.user) user = JSON.parse(req.cookies.user);
	else user = {name: req.body.name, pass: req.body.pass}
	var valid = await isValidUser(user.name, user.pass);
	if(!valid) {
		res.send("ERR: INVALID LOGIN.")
		return;
	}
	var exists = await getLink(req.body.link);
	if(exists){
		res.send({status: "EXISTS", link: "https://greys.tk/"+exists.id});
		return;
	}
	var code = genCode(process.env.CHARACTERS);
	db.query(`INSERT INTO links SET ?`,{id: code, link: req.body.link, name: req.body.linkname},(err,rows)=>{
		if(err) {
			console.log(err);
			res.send("ERR")
		} else {
			res.send({status: "OK", link: "https://greys.tk/"+code});
		}
	})
})

app.post("/unlink",async (req,res)=>{
	var user;
	if(req.cookies.user) user = JSON.parse(req.cookies.user);
	else user = {name: req.body.name, pass: req.body.pass}
	var valid = await isValidUser(user.name, user.pass);
	if(!valid) {
		res.send("ERR: INVALID LOGIN.")
		return;
	}
	var exists = await getLinkID(req.body.link);
	if(!exists){
		res.send({status: "DOES NOT EXIST"});
		return;
	}
	db.query(`DELETE FROM links WHERE id=?`,[req.body.link],(err,rows)=>{
		if(err) {
			console.log(err);
			res.send("ERR")
		} else {
			res.send({status: "OK"});
		}
	})
})

app.post("/links",async (req,res)=>{
	var user;
	var links;
	if(req.cookies.user) user = JSON.parse(req.cookies.user);
	else user = {name: req.body.name, pass: req.body.pass}
	var valid = await isValidUser(user.name, user.pass);
	if(!valid) {
		res.send("ERR: INVALID LOGIN.")
		return;
	} else {
		links = await getLinks();
		res.send(links);
	}
})

app.post("/login",async (req,res)=>{
	var valid = await isValidUser(req.body.name, req.body.pass);
	if(!valid) {
		res.send("ERR: INVALID LOGIN.")
		return;
	}
	res.cookie('user', JSON.stringify({name: req.body.name, pass: req.body.pass}), {expires: new Date("1/1/2030")});
	res.redirect('/');
})

setup();
app.listen(process.env.PORT || 8080);

process.on('SIGINT',()=>{
	db.end(()=>{
		console.log("connection severed");
		process.exit();
	})
})

process.on('SIGTERM',()=>{
	db.end(()=>{
		console.log("connection severed");
		process.exit();
	})
})