

class Index {
    home (req, res) {
        res.render('index');
    }
}

module.exports = new Index();