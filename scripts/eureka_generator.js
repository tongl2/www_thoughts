const fs = require('fs');
const path = require('path');
const moment = require('moment');
moment.locale('zh-cn');

hexo.extend.generator.register('eureka', function(locals) {
  const eurekaDir = path.join(hexo.source_dir, '_eureka');
  let eurekaItems = [];
  
  if (fs.existsSync(eurekaDir)) {
    const files = fs.readdirSync(eurekaDir);
    const txtFiles = files.filter(file => path.extname(file) === '.txt');
    
    eurekaItems = txtFiles.map(file => {
      const filePath = path.join(eurekaDir, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 格式化时间
      const createTime = moment(stats.mtime).format('YYYY年MM月DD日 HH:mm');
      
      return {
        filename: file,
        content: content,
        createTime: createTime,
      };
    }).sort((a, b) => {
      // 按创建时间倒序排列
      // 由于我们格式化了时间，需要转换回moment对象进行比较
      const aTime = moment(a.createTime, 'YYYY年MM月DD日 HH:mm');
      const bTime = moment(b.createTime, 'YYYY年MM月DD日 HH:mm');
      return bTime - aTime;
    });
  }
  
  // 构建页面内容
  let eurekaHTML = '';
  if (eurekaItems && eurekaItems.length > 0) {
    eurekaItems.forEach(function(item) {
      eurekaHTML += `
        <div class="eureka-item card mb-3">
          <div class="card-body">
            <div class="eureka-item-content">${item.content}</div>
            <div class="eureka-item-date small text-muted mt-2">
              发布于 ${item.createTime}
            </div>
          </div>
        </div>`;
    });
  } else {
    eurekaHTML = '<p class="text-center">暂无想法。</p>';
  }
  
  const content = `
    <div class="container">
      <div class="row">
        <div class="col-lg-8 col-md-10 mx-auto">
          <div class="eureka-list">
            <h1 class="text-center mb-4">Eureka</h1>
            <div class="eureka-items">
              ${eurekaHTML}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <style>
    .eureka-list {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px 0;
    }
    
    .eureka-item-content {
      white-space: pre-wrap;
      line-height: 1.6;
    }
    
    .eureka-item-date {
      font-size: 0.85rem;
    }
    </style>`;
  
  return {
    path: 'eureka/index.html',
    data: {
      title: 'Eureka',
      content: content
    },
    layout: ['page']
  };
});