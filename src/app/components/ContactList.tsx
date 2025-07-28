'use client'
import { List, Avatar, Typography, Space } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';

const contacts = [
  { name: 'Ngọc Lam', time: '27 phút', online: true },
  { name: 'Thắng Trần', online: true },
  { name: 'Lê Trọng Nghĩa Phan', online: true },
  { name: 'Võ Hoàng Liên', time: '23 phút', online: true },
  { name: 'Mẫn Huy Trần Ngọc', time: '26 phút', online: true },
  { name: 'Thư Lê', time: '32 phút', online: true },
  { name: 'Ứng Nguyễn', online: false },
  { name: 'Chirs Wilson', time: '11 phút', online: true },
  { name: 'Trương Huyền Hân', time: '44 phút', online: true },
  { name: 'Anh Vạn', online: true },
  { name: 'Đặng Ngọc Thảo', online: true },
  { name: 'Kiệt', time: '6 phút', online: true },
  { name: 'Hoàng Ân', online: true },
  { name: 'Trương Dung', online: true },
  { name: 'Gia Bảo', online: false },
  { name: 'Trí Thức', time: '30 phút', online: true },
  { name: 'Công Toại Đinh', time: '26 phút', online: true }
];

const ContactList = () => {
  const handleCallClick = (e: React.MouseEvent<HTMLSpanElement>, name: string) => {
    e.stopPropagation()
    const w = 400;
    const h = 500;
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;

    const width = window.innerWidth
    const height = window.innerHeight

    const left = ((width / 2) - (w / 2)) + dualScreenLeft;
    const top = ((height / 2) - (h / 2)) + dualScreenTop;

    window.open(
      `/call?name=${encodeURIComponent(name)}`,
      '_blank',
      `popup=yes,width=${w},height=${h},top=${top},left=${left},toolbar=no,menubar=no,location=no,status=no`
    );
  }

  return (
    <div className="w-[300px] h-[calc(100vh-64px)] p-4 overflow-y-auto">
      <Typography.Title level={5} className="text-black">Người liên hệ</Typography.Title>
      <List
        itemLayout="horizontal"
        dataSource={contacts}
        renderItem={(item) => (
          <List.Item 
            className="hover:bg-[#b7b7bd] rounded px-2 py-1 cursor-pointer"
            onClick={() => console.log(`Mở cửa sổ chat với ${item.name}`)}
          >
            <List.Item.Meta
              avatar={
                <Avatar src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`} />
              }
              title={
                <Space>
                  <span className="text-black">{item.name}</span>
                  <VideoCameraOutlined
                    onClick={(e) => handleCallClick(e, item.name)}
                    className="text-black hover:text-blue-500"
                  />
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
};

export default ContactList;
