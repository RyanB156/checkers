
let RestAPI = require('./restAPI');

class Data {
  constructor(name, data) {
    this.name = name;
    this.data = data;
  }
}

let api = new RestAPI('./data.json', true);

let data = [
  new Data('a', {age: 22}),
  new Data('b', {age: 18}),
  new Data('c', {age:5})
];

for (datum of data) {
  api.add(datum.name, datum);
}

console.log(api.getAll().data);
