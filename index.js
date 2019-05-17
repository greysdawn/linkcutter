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
app.use(userAuth);

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

function userAuth(req, res, next) {
	var user = (req.cookies.user ? JSON.parse(req.cookies.user) : {username: req.body.username, pass: req.body.pass});
	db.query(`SELECT * FROM users WHERE name=? AND password=?`,[user.username, user.pass],(err,rows)=>{
		if(err) {
			console.log(err);
			req.verified = false;
		}
		if(rows[0]) {
			req.verified = true;
		} else {
			req.verified = false;
		}
		next()
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

function createLink(link, name, id) {
	var exists;
	return new Promise(async (res)=>{
		exists = await getLink(link);
		if(exists) {
			return res({status:'EXISTS', link: 'https://greys.tk/'+exists.id});
		} else if(id) {
			exists = await getLinkID(id);
			if(exists) {
				res({status:'EXISTS', link: 'https://greys.tk/'+exists.id});
			} else {
				db.query(`INSERT INTO links SET ?`,{id: id, link: link, name: name},(err,rows)=>{
					if(err) {
						console.log(err);
						res.send("ERR")
					} else {
						res({status: "OK", link: "https://greys.tk/"+id});
					}
				})
			}
		} else {
			var code = genCode(process.env.CHARACTERS);
			db.query(`INSERT INTO links SET ?`,{id: code, link: link, name: name},(err,rows)=>{
				if(err) {
					console.log(err);
					res.send("ERR")
				} else {
					res({status: "OK", link: "https://greys.tk/"+code});
				}
			})
		}
	})
}

function deleteLink(id) {
	var exists;
	return new Promise(async (res)=>{
		exists = await getLinkID(id);
		if(exists) {
			db.query(`DELETE FROM links WHERE id=?`,[id],(err,rows)=>{
				if(err) {
					console.log(err);
					res({status: "ERR"})
				} else {
					res({status: "OK"});
				}
			})
		} else {
			return res({status:'DOES NOT EXIST'});
		}
	})
}

app.get("/",async (req,res)=>{
	var logged;
	var links = [];
	links = await getLinks();
	res.render("index.ejs",{logged_in: req.verified, links: links});
})

app.get("/:id",async (req,res)=>{
	var link = await getLinkID(req.params.id);
	if(link) {
		res.redirect(link.link);
	} else {
		res.send({status: "NOT FOUND"});
	}
})

app.post("/link",async (req,res)=>{
	if(!req.verified) return res.send({status: "INVALID LOGIN."});
	var dat = await createLink(req.body.link, req.body.name, req.body.id || undefined);
	res.send(dat);
})

app.post("/unlink",async (req,res)=>{
	if(!req.verified) return res.send({status: "INVALID LOGIN."});
	var dat = await deleteLink(req.body.link);
	res.send(dat);
})

app.post("/links",async (req,res)=>{
	if(!req.verified) {
		return res.send({status: "INVALID LOGIN."});
	} else {
		links = await getLinks();
		res.send(links);
	}
})

app.post("/login", async (req,res)=>{
	if(!req.verified) {
		res.send({status: "INVALID LOGIN."})
		return;
	}
	res.cookie('user', JSON.stringify({username: req.body.username, pass: req.body.pass}), {expires: new Date("1/1/2030")});
	res.send({status: 'OK'});
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