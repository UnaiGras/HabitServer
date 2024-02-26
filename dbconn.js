const mongoose = require('mongoose')
require('dotenv').config()

const MONGODB_URI = `mongodb+srv://unaigrasmedina:95mLanoeQ5xKQbXj@naiselcluster.8fc0wky.mongodb.net/?retryWrites=true&w=majority&appName=NaiselCluster`


mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
})
.then(() => {
    console.log('connected to MongoDB')
}).catch(error => {
    console.log(error.message)
})