const fs = require('fs');
const path = require('path');
const moment = require('moment');
moment.locale('zh-cn');

// 从文件名中解析时间戳
// 文件名格式: yyyy-MM-DD-HH-MM-SS---X.txt
function parseTimestampFromFilename(filename) {
  const separator = '---';
  const separatorIndex = filename.indexOf(separator);

  if (separatorIndex === -1) {
    return null;
  }

  const timestampStr = filename.substring(0, separatorIndex);
  const time = moment(timestampStr, 'YYYY-MM-DD-HH-mm-ss');

  return time.isValid() ? time : null;
}

hexo.extend.generator.register('eureka', function(locals) {
  const eurekaDir = path.join(hexo.source_dir, '_eureka');
  let eurekaItems = [];

  if (fs.existsSync(eurekaDir)) {
    const files = fs.readdirSync(eurekaDir);
    const txtFiles = files.filter(file => path.extname(file) === '.txt');

    eurekaItems = txtFiles.map(file => {
      const filePath = path.join(eurekaDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const createTimeMoment = parseTimestampFromFilename(file);

      if (!createTimeMoment) {
        throw new Error(`Invalid eureka filename format: ${file}. Expected format: yyyy-MM-DD-HH-MM-SS---X.txt`);
      }

      // 格式化时间
      const createTime = createTimeMoment.format('YYYY年MM月DD日 HH:mm');

      return {
        filename: file,
        content: content,
        createTime: createTime,
        createTimeMoment: createTimeMoment,
      };
    }).sort((a, b) => {
      // 按创建时间倒序排列
      return b.createTimeMoment - a.createTimeMoment;
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
